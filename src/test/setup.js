import '@testing-library/jest-dom'
import {
  IDBFactory,
  IDBKeyRange,
  IDBCursor,
  IDBCursorWithValue,
  IDBDatabase,
  IDBIndex,
  IDBObjectStore,
  IDBOpenDBRequest,
  IDBRequest,
  IDBTransaction,
  IDBVersionChangeEvent,
} from 'fake-indexeddb'

// Set up all fake-indexeddb globals so IndexedDB is available in tests
global.indexedDB = new IDBFactory()
global.IDBKeyRange = IDBKeyRange
global.IDBCursor = IDBCursor
global.IDBCursorWithValue = IDBCursorWithValue
global.IDBDatabase = IDBDatabase
global.IDBIndex = IDBIndex
global.IDBObjectStore = IDBObjectStore
global.IDBOpenDBRequest = IDBOpenDBRequest
global.IDBRequest = IDBRequest
global.IDBTransaction = IDBTransaction
global.IDBVersionChangeEvent = IDBVersionChangeEvent
