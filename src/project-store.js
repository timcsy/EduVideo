// IndexedDB stores actual Blobs atomically alongside their edit decisions.
export async function openStore() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('eduvideo-studio-v2', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return {
    recovery: () => new Promise((resolve, reject) => { const r = db.transaction('projects').objectStore('projects').get('recovery'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }),
    saveRecovery: value => new Promise((resolve, reject) => { const t = db.transaction('projects', 'readwrite'); if (value) t.objectStore('projects').put(value, 'recovery'); else t.objectStore('projects').delete('recovery'); t.oncomplete = resolve; t.onerror = () => reject(t.error); }),
    load: () => new Promise((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }),
    save: value => new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readwrite');
      transaction.objectStore('projects').put(value, 'current');
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('保存已中止'));
    })
  };
}
