import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * DraggableWebcamPip — Movable corner PIP webcam feed
 * - Draggable anywhere across the viewport so it never blocks editor content or chat
 * - Clamped within viewport bounds
 * - Persists dragged coordinates in sessionStorage across re-renders
 * - Keeps live MediaPipe video stream & proctoring status badges intact
 */
export default function DraggableWebcamPip({ videoRef, faceCount }) {
  const [position, setPosition] = useState(() => {
    try {
      const saved = sessionStorage.getItem('webcam_pip_position');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    // Default: bottom-right corner with 16px margins
    return {
      x: typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 160) : 100,
      y: typeof window !== 'undefined' ? Math.max(16, window.innerHeight - 150) : 100,
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const containerRef = useRef(null);

  // Keep within bounds on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const width = 144;
        const height = 132;
        const maxX = Math.max(8, window.innerWidth - width - 8);
        const maxY = Math.max(8, window.innerHeight - height - 8);
        const clampedX = Math.min(Math.max(8, prev.x), maxX);
        const clampedY = Math.min(Math.max(8, prev.y), maxY);
        return { x: clampedX, y: clampedY };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e) => {
    // Only allow left-click dragging
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    if (!touch) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      const width = 144;
      const height = 132;
      const maxX = Math.max(8, window.innerWidth - width - 8);
      const maxY = Math.max(8, window.innerHeight - height - 8);

      const nextX = Math.min(Math.max(8, dragStartRef.current.posX + deltaX), maxX);
      const nextY = Math.min(Math.max(8, dragStartRef.current.posY + deltaY), maxY);

      const newPos = { x: nextX, y: nextY };
      setPosition(newPos);
      try {
        sessionStorage.setItem('webcam_pip_position', JSON.stringify(newPos));
      } catch (_) {}
    };

    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - dragStartRef.current.mouseX;
      const deltaY = touch.clientY - dragStartRef.current.mouseY;

      const width = 144;
      const height = 132;
      const maxX = Math.max(8, window.innerWidth - width - 8);
      const maxY = Math.max(8, window.innerHeight - height - 8);

      const nextX = Math.min(Math.max(8, dragStartRef.current.posX + deltaX), maxX);
      const nextY = Math.min(Math.max(8, dragStartRef.current.posY + deltaY), maxY);

      const newPos = { x: nextX, y: nextY };
      setPosition(newPos);
      try {
        sessionStorage.setItem('webcam_pip_position', JSON.stringify(newPos));
      } catch (_) {}
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        background: '#1A2B3C',
        padding: '4px 6px 6px 6px',
        borderRadius: 8,
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.65)' : '0 4px 14px rgba(0,0,0,0.5)',
        border: isDragging ? '1.5px solid #0E7C86' : '1.5px solid #334155',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.2s, border-color 0.2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      title="Click and drag to move camera preview anywhere on screen"
    >
      {/* Drag handle header bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1px 2px 2px 2px',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <span style={{ fontSize: '0.62rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
          <span style={{ fontSize: '0.75rem', lineHeight: 1 }}>⠿</span> Move
        </span>
        <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.45)' }}>Proctored</span>
      </div>

      {/* Video Container */}
      <div
        style={{
          position: 'relative',
          width: 130,
          height: 98,
          borderRadius: 6,
          overflow: 'hidden',
          background: '#000',
          pointerEvents: 'none', // Allow drag events to bubble cleanly to container
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            background: 'rgba(0,0,0,0.65)',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: '0.62rem',
            color: '#2ECC71',
            fontWeight: 700,
          }}
        >
          ● REC
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            left: 4,
            right: 4,
            background:
              faceCount === 1
                ? 'rgba(46, 204, 113, 0.88)'
                : faceCount > 1
                ? 'rgba(231, 76, 60, 0.95)'
                : 'rgba(241, 196, 15, 0.95)',
            padding: '2px 4px',
            borderRadius: 3,
            fontSize: '0.6rem',
            color: '#fff',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {faceCount === 1
            ? '✓ Face Detected'
            : faceCount > 1
            ? '⚠️ Multiple Faces!'
            : '❌ No Face!'}
        </div>
      </div>
    </div>
  );
}
