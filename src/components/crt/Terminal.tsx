"use client";

import React, { useEffect, useState, useRef } from "react";

interface TerminalProps {
  lines: string[];
  typingSpeed?: number;
  showCursor?: boolean;
  className?: string;
  onComplete?: () => void;
}

export default function Terminal({
  lines,
  typingSpeed = 30,
  showCursor = true,
  className = "",
  onComplete,
}: TerminalProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentLine >= lines.length) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    const line = lines[currentLine];
    if (currentChar >= line.length) {
      setDisplayedLines((prev) => [...prev, line]);
      setCurrentLine((prev) => prev + 1);
      setCurrentChar(0);
      return;
    }

    const timeout = setTimeout(() => {
      setCurrentChar((prev) => prev + 1);
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [currentLine, currentChar, lines, typingSpeed, onComplete]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedLines, currentChar]);

  const currentText =
    currentLine < lines.length
      ? lines[currentLine].slice(0, currentChar)
      : "";

  return (
    <div ref={containerRef} className={`terminal-output ${className}`}>
      {displayedLines.map((line, i) => (
        <div key={i} className="terminal-line">
          {line}
        </div>
      ))}
      {!isComplete && (
        <div className="terminal-line">
          {currentText}
          {showCursor && <span className="terminal-cursor">&#9608;</span>}
        </div>
      )}
      {isComplete && showCursor && (
        <div className="terminal-line">
          <span className="terminal-cursor">&#9608;</span>
        </div>
      )}
    </div>
  );
}

/**
 * Simple one-line terminal prompt
 */
export function TerminalPrompt({
  prefix = ">",
  text,
  className = "",
}: {
  prefix?: string;
  text: string;
  className?: string;
}) {
  return (
    <div className={`terminal-line ${className}`}>
      <span className="text-crt-dim">{prefix}</span>{" "}
      <span className="text-crt">{text}</span>
    </div>
  );
}
