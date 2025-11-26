import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';

/**
 * VirtualList Component
 * Efficient rendering of large lists using virtual scrolling
 * Only renders visible items, dramatically improving performance
 *
 * Usage:
 * <VirtualList
 *   items={largeList}
 *   itemHeight={100}
 *   renderItem={(item, index) => <CourseCard key={item.id} course={item} />}
 *   containerHeight={600}
 * />
 */
const VirtualList = ({
  items = [],
  itemHeight = 100,
  renderItem,
  containerHeight = 600,
  overscan = 5, // Render extra items for smoother scrolling
  loading = false,
  onLoadMore = null,
  className = ''
}) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // Calculate visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex).map((item, idx) => ({
      item,
      index: visibleRange.startIndex + idx
    }));
  }, [items, visibleRange]);

  // Handle scroll
  const handleScroll = useCallback(
    (e) => {
      const newScrollTop = e.target.scrollTop;
      setScrollTop(newScrollTop);

      // Trigger load more when scrolling near bottom
      if (onLoadMore) {
        const scrollPercentage = (newScrollTop + containerHeight) / (items.length * itemHeight);
        if (scrollPercentage > 0.8) {
          onLoadMore();
        }
      }
    },
    [containerHeight, items.length, itemHeight, onLoadMore]
  );

  // Total height calculation
  const totalHeight = items.length * itemHeight;

  // Offset for visible items
  const offsetY = visibleRange.startIndex * itemHeight;

  if (loading && items.length === 0) {
    return (
      <div
        className={`virtual-list loading ${className}`}
        style={{ height: containerHeight }}
      >
        <div className="virtual-list-skeleton" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={`virtual-list empty ${className}`}
        style={{ height: containerHeight }}
      >
        <div className="virtual-list-empty-state">No items to display</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`virtual-list ${className}`}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      {/* Spacer before visible items */}
      <div style={{ height: offsetY }} />

      {/* Visible items */}
      <div>
        {visibleItems.map(({ item, index }) => (
          <div
            key={`${index}-${item.id || index}`}
            style={{
              height: itemHeight,
              display: 'flex',
              alignItems: 'stretch'
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>

      {/* Spacer after visible items */}
      <div style={{ height: Math.max(0, totalHeight - offsetY - visibleItems.length * itemHeight) }} />

      {/* Loading indicator at bottom */}
      {loading && (
        <div className="virtual-list-loading-indicator">
          <div className="spinner" />
          <span>Loading more...</span>
        </div>
      )}
    </div>
  );
};

/**
 * VirtualGrid Component
 * Virtual scrolling for grid layouts (multiple columns)
 *
 * Usage:
 * <VirtualGrid
 *   items={largeList}
 *   columns={4}
 *   itemHeight={300}
 *   renderItem={(item) => <CourseCard key={item.id} course={item} />}
 *   containerHeight={800}
 * />
 */
const VirtualGrid = ({
  items = [],
  columns = 3,
  itemHeight = 300,
  renderItem,
  containerHeight = 800,
  gap = 16,
  overscan = 2,
  loading = false,
  onLoadMore = null,
  className = ''
}) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate row height including gap
  const rowHeight = itemHeight + gap;

  // Calculate visible range based on rows
  const visibleRange = useMemo(() => {
    const startRowIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endRowIndex = Math.min(
      Math.ceil(items.length / columns),
      Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
    );

    const startIndex = startRowIndex * columns;
    const endIndex = Math.min(items.length, endRowIndex * columns);

    return { startIndex, endIndex, startRowIndex };
  }, [scrollTop, rowHeight, containerHeight, items.length, columns, overscan]);

  // Calculate visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex);
  }, [items, visibleRange]);

  // Handle scroll
  const handleScroll = useCallback(
    (e) => {
      const newScrollTop = e.target.scrollTop;
      setScrollTop(newScrollTop);

      // Trigger load more when scrolling near bottom
      if (onLoadMore) {
        const totalRows = Math.ceil(items.length / columns);
        const scrollPercentage =
          (newScrollTop + containerHeight) / (totalRows * rowHeight);
        if (scrollPercentage > 0.8) {
          onLoadMore();
        }
      }
    },
    [containerHeight, items.length, columns, rowHeight, onLoadMore]
  );

  // Grid dimensions
  const totalRows = Math.ceil(items.length / columns);
  const totalHeight = totalRows * rowHeight;
  const offsetY = visibleRange.startRowIndex * rowHeight;

  // Grid width calculation
  const itemWidth = `calc((100% - ${gap * (columns - 1)}px) / ${columns})`;

  if (loading && items.length === 0) {
    return (
      <div
        className={`virtual-grid loading ${className}`}
        style={{ height: containerHeight }}
      >
        <div className="virtual-grid-skeleton" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={`virtual-grid empty ${className}`}
        style={{ height: containerHeight }}
      >
        <div className="virtual-grid-empty-state">No items to display</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`virtual-grid ${className}`}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      {/* Spacer before visible items */}
      <div style={{ height: offsetY }} />

      {/* Grid container */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: `${gap}px`,
          padding: '0 16px'
        }}
      >
        {visibleItems.map((item, idx) => (
          <div key={`${visibleRange.startIndex + idx}-${item.id || idx}`}>
            {renderItem(item, visibleRange.startIndex + idx)}
          </div>
        ))}
      </div>

      {/* Spacer after visible items */}
      <div
        style={{
          height: Math.max(
            0,
            totalHeight -
              offsetY -
              Math.ceil(visibleItems.length / columns) * rowHeight
          )
        }}
      />

      {/* Loading indicator */}
      {loading && (
        <div className="virtual-grid-loading-indicator">
          <div className="spinner" />
          <span>Loading more...</span>
        </div>
      )}
    </div>
  );
};

export { VirtualList, VirtualGrid };
export default VirtualList;
