"use strict";

const offlineLibrary = (() => {
  const database = "knowledge-base-offline";
  const storeName = "copies";

  async function accessCopy(mode, operation) {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const request = operation(transaction.objectStore(storeName));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }

  async function deriveKey(passphrase, salt) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" },
      material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  return {
    remove() {
      return accessCopy("readwrite", store => store.delete("library"));
    },
    async save(records, passphrase) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plain = new TextEncoder().encode(JSON.stringify({ savedAt: new Date().toISOString(), records }));
      const key = await deriveKey(passphrase, salt);
      const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
      await accessCopy("readwrite", store => store.put({ salt, iv, data }, "library"));
    },
    async read(passphrase) {
      const copy = await accessCopy("readonly", store => store.get("library"));
      if (!copy) throw new Error("No offline copy is saved here. Open your library online and save an offline copy first.");
      try {
        const key = await deriveKey(passphrase, copy.salt);
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: copy.iv }, key, copy.data);
        return JSON.parse(new TextDecoder().decode(plain));
      } catch {
        throw new Error("Could not unlock this copy. Check your offline passphrase and try again.");
      }
    }
  };
})();
