/**
 * useLocalStorage Hook
 * 
 * @module hooks/useLocalStorage
 * @description React hook for persisting state to localStorage.
 * Handles serialization, error handling, and storage quotas.
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook that persists state to localStorage
 * 
 * @param {string} key - localStorage key
 * @param {*} initialValue - Default value if nothing stored
 * @param {Object} options - Configuration options
 * @param {Function} options.serialize - Custom serializer (default: JSON.stringify)
 * @param {Function} options.deserialize - Custom deserializer (default: JSON.parse)
 * @returns {[*, Function, Function]} [value, setValue, removeValue]
 * 
 * @example
 * const [positions, setPositions] = useLocalStorage('positions', []);
 */
const useLocalStorage = (key, initialValue, options = {}) => {
  const {
    serialize = JSON.stringify,
    deserialize = JSON.parse,
  } = options;

  // Get initial value from localStorage or use default
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? deserialize(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Save to localStorage whenever value changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const serialized = serialize(storedValue);
      window.localStorage.setItem(key, serialized);
    } catch (error) {
      // Handle quota exceeded
      if (error.name === 'QuotaExceededError') {
        console.warn(`localStorage quota exceeded for key "${key}"`);
        // Could implement cleanup logic here
      } else {
        console.warn(`Error writing localStorage key "${key}":`, error);
      }
    }
  }, [key, storedValue, serialize]);

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setStoredValue, removeValue];
};

/**
 * Check if localStorage is available
 * @returns {boolean}
 */
export const isLocalStorageAvailable = () => {
  try {
    const testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Get storage usage info
 * @returns {{ used: number, total: number, percentage: number }}
 */
export const getStorageUsage = () => {
  let used = 0;
  
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage.getItem(key).length * 2; // UTF-16 encoding
    }
  }
  
  // Typical localStorage limit is 5MB
  const total = 5 * 1024 * 1024;
  
  return {
    used,
    total,
    percentage: (used / total) * 100,
  };
};

export default useLocalStorage;
