import React, { useEffect, useRef, useState, useCallback } from "react";

interface Position {
  x: number;
  y: number;
}

interface Drawing {
  path: Path2D | null;
  color: string;
  image?: HTMLImageElement;
  position?: Position;
}

type ToolType = "select" | "line" | "rect";

function App(): JSX.Element {
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [lineColor, setLineColor] = useState<string>("#000000");
  const [drawingHistory, setDrawingHistory] = useState<Drawing[]>([]);
  const [undoHistory, setUndoHistory] = useState<Drawing[]>([]);
  const [currentPath, setCurrentPath] = useState<Path2D | null>(null);
  const [toolSelected, setToolSelected] = useState<ToolType>(
    "select"
  );
  const [startCoordinates, setStartCoordinates] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onMousedown = (
    e: React.MouseEvent<HTMLCanvasElement, MouseEvent>
  ): void => {

    if(toolSelected === 'select') return;
    setIsDrawing(true);
    const newPath = new Path2D();
    newPath.moveTo(
      e.clientX - (canvasRef.current?.offsetLeft || 0),
      e.clientY - (canvasRef.current?.offsetTop || 0)
    );

    if(toolSelected === 'rect'){
      setIsDrawing(true);
      setStartCoordinates({ x: e.clientX - (canvasRef.current?.offsetLeft || 0), y: e.clientY - (canvasRef.current?.offsetTop || 0) });
    }

    setCurrentPath(newPath);
  };

  const onMousemove = (
    e: React.MouseEvent<HTMLCanvasElement, MouseEvent>
  ): void => {
    const x = e.clientX - (canvasRef.current?.offsetLeft || 0);
    const y = e.clientY - (canvasRef.current?.offsetTop || 0);
    setPosition({ x: e.clientX, y: e.clientY });

    if(toolSelected === "line"){
      if (isDrawing && context && currentPath) {
        currentPath.lineTo(x, y);
        context.strokeStyle = lineColor;
        context.stroke(currentPath);
      }
    }
    else if(toolSelected === "rect"){
      if (isDrawing && context) {
        context.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);
        context.strokeStyle = lineColor;
        context.strokeRect(
          startCoordinates.x,
          startCoordinates.y,
          x - startCoordinates.x,
          y - startCoordinates.y
        );
      }
    }
 
  };

  const onMouseup = (): void => {
    setIsDrawing(false);
    if (currentPath && toolSelected === "line") {
      // Creamos una copia del Path2D actual
      const newPath = new Path2D(currentPath);
      setDrawingHistory([
        ...drawingHistory,
        { path: newPath, color: lineColor },
      ]);
      setCurrentPath(null);
      // Al dibujar algo nuevo, se borra la historia de rehacer
      setUndoHistory([]);
    } else if (toolSelected === 'rect' && startCoordinates) {
      // Si estamos en la herramienta 'rect' y hemos empezado a dibujar un rectángulo
      const x = position.x - (canvasRef.current?.offsetLeft || 0);
      const y = position.y - (canvasRef.current?.offsetTop || 0);
      const rectPath = new Path2D();
      rectPath.rect(
        startCoordinates.x,
        startCoordinates.y,
        x - startCoordinates.x,
        y - startCoordinates.y
      );
      setDrawingHistory([
        ...drawingHistory,
        { path: rectPath, color: lineColor },
      ]);
      setStartCoordinates(null);
    }
  };

  const onMouseout = (): void => {
    setIsDrawing(false);
    if (currentPath) {
      setDrawingHistory([
        ...drawingHistory,
        { path: currentPath, color: lineColor },
      ]);
      setCurrentPath(null);
      // Al dibujar algo nuevo, se borra la historia de rehacer
      setUndoHistory([]);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setLineColor(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>): void => {
    if (e.ctrlKey && e.key === "v") {
      handlePaste();
    } else if (e.ctrlKey && e.key === "z") {
      handleUndo();
    } else if (e.ctrlKey && e.key === "y") {
      handleRedo();
    }
  };

  const handlePaste = (): void => {
    navigator.clipboard.read().then((clipboardItems: ClipboardItems) => {
      clipboardItems.forEach(async (x) => {
        x.getType("image/png")
          .then((blob) => blob as Blob)
          .then((blob) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);

            img.onload = () => {
              if (context) {
                const newDrawing: Drawing = {
                  path: null,
                  color: lineColor,
                  image: img,
                  position: { x: position.x, y: position.y },
                };
                setDrawingHistory([...drawingHistory, newDrawing]);
              }

              URL.revokeObjectURL(url); // Libera la URL del objeto creado
            };

            img.src = url;
          });
      });
    });
  };

  const handleUndo = useCallback((): void => {
    if (drawingHistory.length > 0) {
      const lastDrawing = drawingHistory[drawingHistory.length - 1];
      const updatedHistory = drawingHistory.slice(0, -1);
      setDrawingHistory(updatedHistory);
      setUndoHistory([...undoHistory, lastDrawing]);

      if (context) {
        context.clearRect(
          0,
          0,
          canvasRef.current?.width || 0,
          canvasRef.current?.height || 0
        );

        updatedHistory.forEach(({ path, color, image, position }) => {
          if (path) {
            context.strokeStyle = color;
            context.stroke(path);
          } else if (image) {
            context.drawImage(
              image,
              position.x,
              position.y,
              image.width,
              image.height
            );
          }
        });
      }
    }
  }, [context, drawingHistory, undoHistory]);

  const handleRedo = useCallback((): void => {
    if (undoHistory.length > 0) {
      const lastUndone = undoHistory[undoHistory.length - 1];
      const updatedUndoHistory = undoHistory.slice(0, -1);
      setUndoHistory(updatedUndoHistory);
      setDrawingHistory([...drawingHistory, lastUndone]);

      if (context) {
        if (lastUndone.path) {
          context.strokeStyle = lastUndone.color;
          context.stroke(lastUndone.path);
        } else if (lastUndone.image) {
          context.drawImage(
            lastUndone.image,
            lastUndone.position.x,
            lastUndone.position.y,
            lastUndone.image.width,
            lastUndone.image.height
          );
        }
      }
    }
  }, [context, drawingHistory, undoHistory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        setContext(ctx);
        ctx.lineWidth = 2;
      }
    }
  }, []);

  useEffect(() => {
    const handleResize = (): void => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          drawingHistory.forEach(({ path, color, image, position }) => {
            if (path) {
              context.strokeStyle = color;
              context.stroke(path);
            } else if (image) {
              context.drawImage(
                image,
                position.x,
                position.y,
                image.width,
                image.height
              );
            }
          });
        }
      }
    };

    handleResize();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [context, drawingHistory]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", height: 50 }}>
        <label htmlFor="colorPicker">Color: </label>
        <input
          type="color"
          id="colorPicker"
          value={lineColor}
          onChange={handleColorChange}
        />
        <button onClick={handleUndo}>Undo (Ctrl + Z)</button>
        <button onClick={handleRedo}>Redo (Ctrl + Y)</button>
        <button
         className={toolSelected === "select" ? "selectedButton" : ""}
          onClick={() => {
            setToolSelected("select");
          }}
        >
          Select
        </button>
        <button
         className={toolSelected === "line" ? "selectedButton" : ""}
          onClick={() => {
            setToolSelected("line");
          }}
        >
          Line
        </button>
        <button
         className={toolSelected === "rect" ? "selectedButton" : ""}
          onClick={() => {
            setToolSelected("rect");
          }}
        >
          Rect
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onKeyDown={handleKeyDown}
        onMouseDown={onMousedown}
        onMouseMove={onMousemove}
        tabIndex={0}
        onMouseUp={onMouseup}
        onMouseOut={onMouseout}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          outline: "1px solid #ccc",
        }}
      ></canvas>
    </div>
  );
}

export default App;
