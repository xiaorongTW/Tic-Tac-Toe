import { useEffect, useState } from 'react';

// 0. Constants
// How often the running timer refreshes the screen.
const TICK_MS = 100;

// Every row, column, and diagonal that wins the game.
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// Square indexes grouped into the three rows of the board.
const BOARD_ROWS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
];

// 0. Utils
const formatTime = (ms) => (ms / 1000).toFixed(1) + 's';

const calculateWinner = (squares) => {
  for (const [a, b, c] of WIN_LINES) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
};

// A single square on the board. It is a "controlled" component:
// it receives its value and click handler from the Board via props.
const Square = (props) => {
  // 1. Props
  const { value, onSquareClick, disabled } = props;

  // (main)
  return (
    <button className="square" onClick={onSquareClick} disabled={disabled}>
      {value}
    </button>
  );
};

// The 3x3 board. It holds no state of its own — the Game passes in the
// current squares, whose turn it is, and a callback to report a move.
const Board = (props) => {
  // 1. Props
  const { xIsNext, squares, onPlay, isPaused } = props;

  // 6. Logic and Utils
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

  // 7. Event Handlers
  const handleSquareClick = (i) => {
    // Ignore clicks while paused, on filled squares, or after the game is won.
    if (isPaused || winner || squares[i]) {
      return;
    }
    // Immutability: copy the array instead of mutating it, so the
    // previous board stays intact in history (enables time travel).
    const nextSquares = squares.slice();
    nextSquares[i] = xIsNext ? 'X' : 'O';
    onPlay(nextSquares);
  };

  // 8. Render Functions
  const renderSquare = (i) => (
    <Square
      key={i}
      value={squares[i]}
      onSquareClick={() => handleSquareClick(i)}
      disabled={isPaused}
    />
  );

  const renderRows = () =>
    BOARD_ROWS.map((row, rowIndex) => (
      <div key={rowIndex} className="board-row">
        {row.map(renderSquare)}
      </div>
    ));

  // (main)
  return (
    <>
      <div className="status">{status}</div>
      {renderRows()}
    </>
  );
};

// State is "lifted up" here so the Game owns the full move history and can
// jump back to any past move.
const Game = (props) => {
  // 1. Props
  const { onReset } = props;

  // 3. State
  const [history, setHistory] = useState([Array(9).fill(null)]);
  const [currentMove, setCurrentMove] = useState(0);
  // roundTimes[move] = ms the player spent before making that move.
  // Index 0 is the empty starting board, so it is always 0.
  const [roundTimes, setRoundTimes] = useState([0]);
  // Time spent in the round being played right now.
  const [currentRoundMs, setCurrentRoundMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // 6. Logic and Utils (declared before the Effect because it depends on
  // `isTicking`). Derived values are computed during render instead of
  // being stored in state and kept in sync with an Effect.
  const xIsNext = currentMove % 2 === 0;
  const currentSquares = history[currentMove];
  const isGameOver =
    calculateWinner(currentSquares) !== null || currentSquares.every(Boolean);
  const isTicking = isRunning && !isGameOver;
  const totalMs =
    roundTimes.slice(1, currentMove + 1).reduce((sum, ms) => sum + ms, 0) +
    (isGameOver ? 0 : currentRoundMs);

  let startPauseLabel;
  if (isRunning) {
    startPauseLabel = 'Pause';
  } else if (currentMove === 0 && currentRoundMs === 0) {
    startPauseLabel = 'Start';
  } else {
    startPauseLabel = 'Resume';
  }

  // 5. useEffect
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

  // 7. Event Handlers
  const handlePlay = (nextSquares) => {
    // If we went back in time, discard the "future" moves before adding.
    const nextHistory = [...history.slice(0, currentMove + 1), nextSquares];
    setHistory(nextHistory);
    setCurrentMove(nextHistory.length - 1);
    // Recording the round time is caused by this click, so it belongs
    // here in the event handler, not in an Effect that watches `history`.
    setRoundTimes([...roundTimes.slice(0, currentMove + 1), currentRoundMs]);
    setCurrentRoundMs(0);
  };

  const handleJumpTo = (nextMove) => {
    setCurrentMove(nextMove);
    // A new round starts from the board we jumped to.
    setCurrentRoundMs(0);
  };

  const handleToggleRunning = () => {
    setIsRunning(!isRunning);
  };

  // 8. Render Functions
  const renderControls = () => (
    <div className="controls">
      <button onClick={handleToggleRunning} disabled={isGameOver}>
        {startPauseLabel}
      </button>
      <button onClick={onReset}>Reset game</button>
    </div>
  );

  const renderTimer = () => (
    <div className="timer">
      {!isGameOver && (
        <div>
          Round {currentMove + 1}: {formatTime(currentRoundMs)}
        </div>
      )}
      <div>Total: {formatTime(totalMs)}</div>
    </div>
  );

  // The move index is a stable key: moves are never reordered,
  // inserted, or deleted from the middle.
  const renderMoves = () =>
    history.map((_squares, move) => (
      <li key={move}>
        <button onClick={() => handleJumpTo(move)}>
          {move > 0 ? 'Go to move #' + move : 'Go to game start'}
        </button>
        {move > 0 && (
          <span className="round-time">
            {' '}
            Round {move} ({move % 2 === 1 ? 'X' : 'O'}):{' '}
            {formatTime(roundTimes[move])}
          </span>
        )}
      </li>
    ));

  // (main)
  return (
    <div className="game">
      <div className="game-board">
        {renderControls()}
        {renderTimer()}
        <Board
          xIsNext={xIsNext}
          squares={currentSquares}
          onPlay={handlePlay}
          isPaused={!isRunning}
        />
      </div>
      <div className="game-info">
        <ol>{renderMoves()}</ol>
      </div>
    </div>
  );
};

// Top-level component. Pressing "Reset game" gives <Game> a new key, so
// React throws away the old Game and mounts a fresh one — every piece of
// state (history, timers, running flag) starts over without any code that
// resets each value one by one.
const App = () => {
  // 3. State
  const [gameId, setGameId] = useState(0);

  // 7. Event Handlers
  const handleReset = () => {
    setGameId(gameId + 1);
  };

  // (main)
  return <Game key={gameId} onReset={handleReset} />;
};

export default App;
