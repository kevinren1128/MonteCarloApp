/**
 * Command Item Component
 *
 * @module components/common/CommandItem
 * @description Individual command row for the command palette.
 */

import React, { memo } from 'react';

const CommandItem = memo(({
  command,
  isSelected,
  matches = [],
  onClick,
  onMouseEnter,
}) => {
  // Get match indices for the label field
  const labelMatch = matches.find(m => m.key === 'label');
  const labelIndices = labelMatch?.indices || [];

  // Render text with highlighted matches
  const renderHighlightedText = (text, indices) => {
    if (!indices || indices.length === 0) {
      return text;
    }

    const segments = [];
    let lastIndex = 0;

    // Sort indices by start position
    const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);

    for (const [start, end] of sortedIndices) {
      // Add non-highlighted segment before this match
      if (start > lastIndex) {
        segments.push(
          <span key={`text-${lastIndex}`}>
            {text.slice(lastIndex, start)}
          </span>
        );
      }
      // Add highlighted segment
      segments.push(
        <span
          key={`match-${start}`}
          style={{
            color: '#00d4ff',
            fontWeight: 600,
          }}
        >
          {text.slice(start, end + 1)}
        </span>
      );
      lastIndex = end + 1;
    }

    // Add remaining text after last match
    if (lastIndex < text.length) {
      segments.push(
        <span key={`text-${lastIndex}`}>
          {text.slice(lastIndex)}
        </span>
      );
    }

    return segments;
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        cursor: 'pointer',
        background: isSelected
          ? 'linear-gradient(90deg, rgba(0, 212, 255, 0.15) 0%, rgba(123, 47, 247, 0.1) 100%)'
          : 'transparent',
        borderLeft: isSelected ? '2px solid #00d4ff' : '2px solid transparent',
        transition: 'all 0.1s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        {/* Icon */}
        <span style={{
          fontSize: '16px',
          width: '24px',
          textAlign: 'center',
          opacity: isSelected ? 1 : 0.7,
        }}>
          {command.icon}
        </span>

        {/* Label and category */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{
            fontSize: '13px',
            color: isSelected ? '#fff' : '#ddd',
            fontWeight: isSelected ? 500 : 400,
          }}>
            {renderHighlightedText(command.label, labelIndices)}
          </span>
          <span style={{
            fontSize: '10px',
            color: '#666',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {command.category}
          </span>
        </div>
      </div>

      {/* Shortcut badge */}
      {command.shortcut && (
        <div style={{ display: 'flex', gap: '4px' }}>
          {command.shortcut.split('').map((char, i) => {
            // Handle special characters like modifier keys
            if (char === '⌘' || char === '⇧') {
              return (
                <kbd
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '22px',
                    height: '22px',
                    padding: '0 6px',
                    background: isSelected
                      ? 'rgba(0, 212, 255, 0.2)'
                      : 'rgba(255, 255, 255, 0.08)',
                    border: `1px solid ${isSelected ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: isSelected ? '#00d4ff' : '#888',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
                  }}
                >
                  {char}
                </kbd>
              );
            }
            // Regular character
            return (
              <kbd
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '22px',
                  height: '22px',
                  padding: '0 6px',
                  background: isSelected
                    ? 'rgba(0, 212, 255, 0.2)'
                    : 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${isSelected ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: isSelected ? '#00d4ff' : '#888',
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                }}
              >
                {char}
              </kbd>
            );
          })}
        </div>
      )}
    </div>
  );
});

CommandItem.displayName = 'CommandItem';

export default CommandItem;
