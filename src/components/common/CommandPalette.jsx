/**
 * Command Palette Component
 *
 * @module components/common/CommandPalette
 * @description VS Code-style command palette with fuzzy search.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import CommandItem from './CommandItem';
import { COMMANDS, COMMAND_CATEGORIES } from '../../constants/commands';
import { createFuzzySearch, simpleFuzzySearch } from '../../utils/fuzzySearch';

const CommandPalette = memo(({
  isOpen,
  onClose,
  onExecuteCommand,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Create fuzzy search instance
  const fuzzySearch = useMemo(() => {
    try {
      return createFuzzySearch(COMMANDS);
    } catch (e) {
      // Fallback if Fuse.js isn't available
      console.warn('Fuse.js not available, using simple search');
      return null;
    }
  }, []);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (fuzzySearch) {
      const results = fuzzySearch(query, 15);
      return results;
    }
    // Fallback to simple search
    return simpleFuzzySearch(COMMANDS, query);
  }, [query, fuzzySearch]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups = {};
    let flatIndex = 0;

    for (const result of filteredCommands) {
      const command = result.item;
      const category = command.category;

      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push({
        ...result,
        flatIndex: flatIndex++,
      });
    }

    return { groups, totalCount: flatIndex };
  }, [filteredCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector('[aria-selected="true"]');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    const { totalCount } = groupedCommands;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, totalCount));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalCount) % Math.max(1, totalCount));
        break;

      case 'Enter':
        e.preventDefault();
        const selectedResult = filteredCommands[selectedIndex];
        if (selectedResult) {
          handleExecute(selectedResult.item);
        }
        break;

      case 'Escape':
        e.preventDefault();
        onClose();
        break;

      case 'Tab':
        // Prevent tab from moving focus out
        e.preventDefault();
        break;

      default:
        break;
    }
  }, [groupedCommands, selectedIndex, filteredCommands, onClose]);

  // Execute command
  const handleExecute = useCallback((command) => {
    onClose();
    onExecuteCommand(command);
  }, [onClose, onExecuteCommand]);

  // Handle mouse selection
  const handleMouseEnter = useCallback((flatIndex) => {
    setSelectedIndex(flatIndex);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        style={styles.container}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div style={styles.inputContainer}>
          <span style={styles.searchIcon}>⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command..."
            style={styles.input}
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-activedescendant={`command-${selectedIndex}`}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={styles.clearButton}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          id="command-list"
          role="listbox"
          style={styles.list}
        >
          {groupedCommands.totalCount === 0 ? (
            <div style={styles.noResults}>
              <span style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</span>
              <span>No commands found</span>
              <span style={{ fontSize: '11px', color: '#666' }}>
                Try a different search term
              </span>
            </div>
          ) : (
            Object.entries(groupedCommands.groups).map(([category, commands]) => (
              <div key={category}>
                {/* Category header */}
                <div style={styles.categoryHeader}>
                  {category}
                </div>
                {/* Commands in category */}
                {commands.map(result => (
                  <CommandItem
                    key={result.item.id}
                    command={result.item}
                    isSelected={result.flatIndex === selectedIndex}
                    matches={result.matches || []}
                    onClick={() => handleExecute(result.item)}
                    onMouseEnter={() => handleMouseEnter(result.flatIndex)}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.footerHints}>
            <span style={styles.hint}>
              <kbd style={styles.kbd}>↑↓</kbd> navigate
            </span>
            <span style={styles.hint}>
              <kbd style={styles.kbd}>↵</kbd> select
            </span>
            <span style={styles.hint}>
              <kbd style={styles.kbd}>esc</kbd> close
            </span>
          </div>
          <span style={styles.resultCount}>
            {groupedCommands.totalCount} command{groupedCommands.totalCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
});

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15vh',
    zIndex: 10002,
  },

  container: {
    width: '100%',
    maxWidth: '560px',
    background: 'linear-gradient(180deg, rgba(30, 30, 50, 0.98) 0%, rgba(20, 20, 35, 0.98) 100%)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 212, 255, 0.1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },

  inputContainer: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    gap: '12px',
  },

  searchIcon: {
    fontSize: '18px',
    color: '#00d4ff',
    fontWeight: 600,
  },

  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: '15px',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },

  clearButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '4px',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#888',
    fontSize: '16px',
    transition: 'all 0.15s ease',
  },

  list: {
    maxHeight: '400px',
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: '#3a3a5a #1a1a2e',
  },

  categoryHeader: {
    padding: '8px 16px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#666',
    background: 'rgba(0, 0, 0, 0.2)',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },

  noResults: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: '#888',
    fontSize: '13px',
    gap: '4px',
  },

  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(0, 0, 0, 0.2)',
  },

  footerHints: {
    display: 'flex',
    gap: '16px',
  },

  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#666',
  },

  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '18px',
    height: '18px',
    padding: '0 4px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 500,
    color: '#888',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  },

  resultCount: {
    fontSize: '11px',
    color: '#666',
  },
};

CommandPalette.displayName = 'CommandPalette';

export default CommandPalette;
