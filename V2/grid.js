let canvas;
let gl;
let program;

let vBuffer, cBuffer;
let vPosition, vColor;
let uModelViewMatrix, uProjectionMatrix;

let positionsArray = [];
let colorsArray = [];
let faceColors = [];

const GRID_SIZE = 10;
let grid = [];
let nextGrid = [];

let rotationX = 30;
let rotationY = 45;
let dragging = false;
let lastClientX, lastClientY;
let zoom = -20;

let nextGameTick = Date.now();
const skipTicks = 500;
const maxFrameSkip = 10;

window.onload = function init() {
    // Initialize Canvas and WebGL Context
    canvas = document.getElementById("gl-canvas");
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
        return;
    }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.8, 0.8, 0.8, 1.0);
    gl.enable(gl.DEPTH_TEST);

    // Load Shaders and Initialize Attribute Buffers
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Define the Cube Geometry and Colors
    defineCube();

    // Setup Buffers
    Buffers();

    // Get Uniform Locations
    uModelViewMatrix = gl.getUniformLocation(program, "uModelViewMatrix");
    uProjectionMatrix = gl.getUniformLocation(program, "uProjectionMatrix");

    // Initialize the Grids
    grid = create3DArray(GRID_SIZE);
    nextGrid = create3DArray(GRID_SIZE);
    initializeGrid();

    // Setup Mouse Controls
    mouseControls();

    // Start the Rendering and Game Loops
    render();
    gameLoop();
};
function defineCube() {
    const vertices = [
        vec4(-0.4, -0.4,  0.4, 1.0),
        vec4( 0.4, -0.4,  0.4, 1.0),
        vec4( 0.4,  0.4,  0.4, 1.0),
        vec4(-0.4,  0.4,  0.4, 1.0),
        vec4(-0.4, -0.4, -0.4, 1.0),
        vec4( 0.4, -0.4, -0.4, 1.0),
        vec4( 0.4,  0.4, -0.4, 1.0),
        vec4(-0.4,  0.4, -0.4, 1.0)
    ];
    faceColors = [
        vec4(1.0, 0.0, 0.0, 1.0), //Red
        vec4(0.0, 1.0, 0.0, 1.0), //Green
        vec4(0.0, 0.0, 1.0, 1.0), //Blue
        vec4(1.0, 1.0, 0.0, 1.0), //Yellow
        vec4(1.0, 0.0, 1.0, 1.0), //Magenta
        vec4(0.0, 1.0, 1.0, 1.0)  //Cyan
    ];
    function quad(a, b, c, d, faceColor) {
        positionsArray.push(vertices[a]);
        colorsArray.push(faceColor);
        positionsArray.push(vertices[b]);
        colorsArray.push(faceColor);
        positionsArray.push(vertices[c]);
        colorsArray.push(faceColor);

        positionsArray.push(vertices[a]);
        colorsArray.push(faceColor);
        positionsArray.push(vertices[c]);
        colorsArray.push(faceColor);
        positionsArray.push(vertices[d]);
        colorsArray.push(faceColor);
    }
    quad(0, 1, 2, 3, faceColors[0]);
    quad(1, 5, 6, 2, faceColors[1]);
    quad(5, 4, 7, 6, faceColors[2]);
    quad(4, 0, 3, 7, faceColors[3]);
    quad(3, 2, 6, 7, faceColors[4]);
    quad(4, 5, 1, 0, faceColors[5]);
}
function Buffers() {
    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(positionsArray), gl.STATIC_DRAW);

    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colorsArray), gl.STATIC_DRAW);

    vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);
}
function create3DArray(size) {
    const arr = new Array(size);
    for (let x = 0; x < size; x++) {
        arr[x] = new Array(size);
        for (let y = 0; y < size; y++) {
            arr[x][y] = new Array(size);
        }
    }
    return arr;
}
function initializeGrid() {
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let z = 0; z < GRID_SIZE; z++) {
                const isAlive = Math.random() < 0.2 ? 1 : 0;
                grid[x][y][z] = {
                    isAlive: isAlive,
                    size: isAlive ? 1.0 : 0.0
                };
            }
        }
    }
}
function countLivingNeighbors(x, y, z) {
    let count = 0;

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dy === 0 && dz === 0) continue;

                const nx = x + dx;
                const ny = y + dy;
                const nz = z + dz;

                if (
                    nx >= 0 && nx < GRID_SIZE &&
                    ny >= 0 && ny < GRID_SIZE &&
                    nz >= 0 && nz < GRID_SIZE
                ) {
                    count += grid[nx][ny][nz].isAlive;
                }
            }
        }
    }

    return count;
}
function updateGrid() {
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let z = 0; z < GRID_SIZE; z++) {
                const cell = grid[x][y][z];
                const livingNeighbors = countLivingNeighbors(x, y, z);
                let nextIsAlive = cell.isAlive;

                if (cell.isAlive) {
                    if (livingNeighbors >= 5 && livingNeighbors <= 7) {
                        nextIsAlive = 1;
                    } else {
                        nextIsAlive = 0;
                    }
                } else {
                    if (livingNeighbors === 6) {
                        nextIsAlive = 1;
                    } else {
                        nextIsAlive = 0;
                    }
                }

                nextGrid[x][y][z] = {
                    isAlive: nextIsAlive,
                    size: cell.size
                };
            }
        }
    }

    [grid, nextGrid] = [nextGrid, grid];
}
function mouseControls() {
    canvas.addEventListener("mousedown", (event) => {
        dragging = true;
        lastClientX = event.clientX;
        lastClientY = event.clientY;
    });

    canvas.addEventListener("mouseup", () => {
        dragging = false;
    });

    canvas.addEventListener("mousemove", (event) => {
        if (dragging) {
            const deltaX = event.clientX - lastClientX;
            const deltaY = event.clientY - lastClientY;
            rotationY += deltaX * 0.5;
            rotationX += deltaY * 0.5;
            lastClientX = event.clientX;
            lastClientY = event.clientY;
        }
    });

    canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        zoom -= event.deltaY * 0.05;
        zoom = Math.min(Math.max(zoom, -100), -5);
    });
}
function gameLoop() {
    let loops = 0;
    const currentTime = Date.now();
    while (currentTime > nextGameTick && loops < maxFrameSkip) {
        updateGrid();
        nextGameTick += skipTicks;
        loops++;
    }

    requestAnimFrame(gameLoop);
}
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = canvas.width / canvas.height;
    const projMatrix = perspective(90.0, aspect, 1.0, 10000.0);
    gl.uniformMatrix4fv(uProjectionMatrix, false, flatten(projMatrix));

    let baseModelViewMatrix = mat4();
    baseModelViewMatrix = mult(baseModelViewMatrix, translate(0, 0, zoom));
    baseModelViewMatrix = mult(baseModelViewMatrix, rotateX(rotationX));
    baseModelViewMatrix = mult(baseModelViewMatrix, rotateY(rotationY));

    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let z = 0; z < GRID_SIZE; z++) {
                const cell = grid[x][y][z];
                if (cell.isAlive && cell.size < 1.0) {
                    cell.size = Math.min(cell.size + 0.1, 1.0);
                } else if (!cell.isAlive && cell.size > 0.0) {
                    cell.size = Math.max(cell.size - 0.1, 0.0);
                }

                if (cell.size > 0.0) {
                    let modelViewMatrix = baseModelViewMatrix;
                    modelViewMatrix = mult(
                        modelViewMatrix,
                        translate(
                            x - GRID_SIZE / 2 + 0.5,
                            y - GRID_SIZE / 2 + 0.5,
                            z - GRID_SIZE / 2 + 0.5
                        )
                    );

                    const scale = cell.size * 0.8;
                    modelViewMatrix = mult(
                        modelViewMatrix,
                        scalem(scale, scale, scale)
                    );
                    gl.uniformMatrix4fv(uModelViewMatrix, false, flatten(modelViewMatrix));

                    gl.drawArrays(gl.TRIANGLES, 0, 36);
                }
            }
        }
    }
    requestAnimFrame(render);
}