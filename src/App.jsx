import { useEffect, useState } from 'react';

// How often the running timer refreshes the screen.
const TICK_MS = 100;

// A single square on the board. It is a "controlled" component:
// it receives its value and click handler from the Board via props.
function Square({ value, onSquareClick, disabled }) {
  return (
    <button className="square" onClick={onSquareClick} disabled={disabled}>
      {value}
    </button>
  );
}

// The 3x3 board. It holds no state of its own — the Game passes in the
// current squares, whose turn it is, and a callback to report a move.
function Board({ xIsNext, squares, onPlay, isPaused }) {
  function handleClick(i) {
    // Ignore clicks while paused, on filled squares, or after the game is won.
    if (isPaused || calculateWinner(squares) || squares[i]) {
      return;
    }
    // Immutability: copy the array instead of mutating it, so the
    // previous board stays intact in history (enables time travel).
    const nextSquares = squares.slice();
    nextSquares[i] = xIsNext ? 'X' : 'O';
    onPlay(nextSquares);
  }

  const winner = calculateWinner(squares);
  let status;
  if (winner) {
    status = 'Winner: ' + winner;
  } else if (squares.every(Boolean)) {
    status = 'Draw';
  } else if (isPaused) {
    status = 'Paused — press Start to play';
  } else {
    status = 'Next player: ' + (xIsNext ? 'X' : 'O');
  }

  return (
    <>
      <div className="status">{status}</div>
      <div className="board-row">
        <Square value={squares[0]} onSquareClick={() => handleClick(0)} disabled={isPaused} />
        <Square value={squares[1]} onSquareClick={() => handleClick(1)} disabled={isPaused} />
        <Square value={squares[2]} onSquareClick={() => handleClick(2)} disabled={isPaused} />
      </div>
      <div className="board-row">
        <Square value={squares[3]} onSquareClick={() => handleClick(3)} disabled={isPaused} />
        <Square value={squares[4]} onSquareClick={() => handleClick(4)} disabled={isPaused} />
        <Square value={squares[5]} onSquareClick={() => handleClick(5)} disabled={isPaused} />
      </div>
      <div className="board-row">
        <Square value={squares[6]} onSquareClick={() => handleClick(6)} disabled={isPaused} />
        <Square value={squares[7]} onSquareClick={() => handleClick(7)} disabled={isPaused} />
        <Square value={squares[8]} onSquareClick={() => handleClick(8)} disabled={isPaused} />
      </div>
    </>
  );
}

// Top-level component. Pressing "Reset game" gives <Game> a new key, so
// React throws away the old Game and mounts a fresh one — every piece of
// state (history, timers, running flag) starts over without any code that
// resets each value one by one.
export default function App() {
  const [gameId, setGameId] = useState(0);
  return <Game key={gameId} onReset={() => setGameId(gameId + 1)} />;
}

// State is "lifted up" here so the Game owns the full move history and can
// jump back to any past move.
function Game({ onReset }) {
  const [history, setHistory] = useState([Array(9).fill(null)]);
  const [currentMove, setCurrentMove] = useState(0);
  // roundTimes[move] = ms the player spent before making that move.
  // Index 0 is the empty starting board, so it is always 0.
  const [roundTimes, setRoundTimes] = useState([0]);
  // Time spent in the round being played right now.
  const [currentRoundMs, setCurrentRoundMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Derived values — computed during render instead of being stored in
  // state and kept in sync with an Effect.
  const xIsNext = currentMove % 2 === 0;
  const currentSquares = history[currentMove];
  const isGameOver =
    calculateWinner(currentSquares) !== null || currentSquares.every(Boolean);
  const isTicking = isRunning && !isGameOver;
  const totalMs =
    roundTimes.slice(1, currentMove + 1).reduce((sum, ms) => sum + ms, 0) +
    (isGameOver ? 0 : currentRoundMs);

  // The ONLY Effect: keep a browser interval (an external system) in sync
  // with whether the clock should be ticking. The cleanup clears the
  // interval on pause, game over, reset (unmount), and the extra
  // setup→cleanup→setup that StrictMode runs in development.
  useEffect(() => {
    if (!isTicking) {
      return;
    }
    // Add the real time since the last tick rather than a fixed TICK_MS,
    // so the clock stays accurate even if the browser delays the interval
    // (e.g. in a background tab).
    const clock = { last: Date.now() };
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - clock.last;
      clock.last = now;
      setCurrentRoundMs((ms) => ms + delta);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isTicking]);

  function handlePlay(nextSquares) {
    // If we went back in time, discard the "future" moves before adding.
    const nextHistory = [...history.slice(0, currentMove + 1), nextSquares];
    setHistory(nextHistory);
    setCurrentMove(nextHistory.length - 1);
    // Recording the round time is caused by this click, so it belongs
    // here in the event handler, not in an Effect that watches `history`.
    setRoundTimes([...roundTimes.slice(0, currentMove + 1), currentRoundMs]);
    setCurrentRoundMs(0);
  }

  function jumpTo(nextMove) {
    setCurrentMove(nextMove);
    // A new round starts from the board we jumped to.
    setCurrentRoundMs(0);
  }

  function toggleRunning() {
    setIsRunning(!isRunning);
  }

  let startPauseLabel;
  if (isRunning) {
    startPauseLabel = 'Pause';
  } else if (currentMove === 0 && currentRoundMs === 0) {
    startPauseLabel = 'Start';
  } else {
    startPauseLabel = 'Resume';
  }

  const moves = history.map((squares, move) => {
    let description;
    if (move > 0) {
      description = 'Go to move #' + move;
    } else {
      description = 'Go to game start';
    }
    // The move index is a stable key: moves are never reordered,
    // inserted, or deleted from the middle.
    return (
      <li key={move}>
        <button onClick={() => jumpTo(move)}>{description}</button>
        {move > 0 && (
          <span className="round-time">
            {' '}
            Round {move} ({move % 2 === 1 ? 'X' : 'O'}):{' '}
            {formatTime(roundTimes[move])}
          </span>
        )}
      </li>
    );
  });

  return (
    <div className="game">
      <div className="game-board">
        <div className="controls">
          <button onClick={toggleRunning} disabled={isGameOver}>
            {startPauseLabel}
          </button>
          <button onClick={onReset}>Reset game</button>
        </div>
        <div className="timer">
          {!isGameOver && (
            <div>
              Round {currentMove + 1}: {formatTime(currentRoundMs)}
            </div>
          )}
          <div>Total: {formatTime(totalMs)}</div>
        </div>
        <Board
          xIsNext={xIsNext}
          squares={currentSquares}
          onPlay={handlePlay}
          isPaused={!isRunning}
        />
      </div>
      <div className="game-info">
        <ol>{moves}</ol>
      </div>
    </div>
  );
}

function formatTime(ms) {
  return (ms / 1000).toFixed(1) + 's';
}

function calculateWinner(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}
