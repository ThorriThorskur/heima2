// Global Variables
let canvas;
let gl;
let program;

// Buffers and Shader Attributes
let vBuffer, cBuffer;
let vPosition, vColor;
let uModelViewMatrix, uProjectionMatrix;

// Geometry Data
let positionsArray = [];
let colorsArray = [];
let faceColors = [];

// Grid Configuration
const GRID_SIZE = 10;
let grid = [];
let nextGrid = [];

// Interaction Variables
let rotationX = 30;  // Initial rotation angles
let rotationY = 45;
let dragging = false;
let lastClientX, lastClientY;
let zoom = -20;

// Timing Variables for the Game Loop
let nextGameTick = Date.now();
const skipTicks = 500; // Update every 500 milliseconds
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
    setupBuffers();

    // Get Uniform Locations
    uModelViewMatrix = gl.getUniformLocation(program, "uModelViewMatrix");
    uProjectionMatrix = gl.getUniformLocation(program, "uProjectionMatrix");

    // Initialize the Grids
    grid = create3DArray(GRID_SIZE);
    nextGrid = create3DArray(GRID_SIZE);
    initializeGrid();

    // Setup Mouse Controls
    setupMouseControls();

    // Start the Rendering and Game Loops
    render();
    gameLoop();
};

// Function to Define the Cube Geometry and Colors
function defineCube() {
    // Define the Vertices of the Cube
    const vertices = [
        vec4(-0.4, -0.4,  0.4, 1.0), // 0: Front-bottom-left
        vec4( 0.4, -0.4,  0.4, 1.0), // 1: Front-bottom-right
        vec4( 0.4,  0.4,  0.4, 1.0), // 2: Front-top-right
        vec4(-0.4,  0.4,  0.4, 1.0), // 3: Front-top-left
        vec4(-0.4, -0.4, -0.4, 1.0), // 4: Back-bottom-left
        vec4( 0.4, -0.4, -0.4, 1.0), // 5: Back-bottom-right
        vec4( 0.4,  0.4, -0.4, 1.0), // 6: Back-top-right
        vec4(-0.4,  0.4, -0.4, 1.0)  // 7: Back-top-left
    ];

    // Define the Face Colors
    faceColors = [
        vec4(1.0, 0.0, 0.0, 1.0), // Front face - Red
        vec4(0.0, 1.0, 0.0, 1.0), // Right face - Green
        vec4(0.0, 0.0, 1.0, 1.0), // Back face - Blue
        vec4(1.0, 1.0, 0.0, 1.0), // Left face - Yellow
        vec4(1.0, 0.0, 1.0, 1.0), // Top face - Magenta
        vec4(0.0, 1.0, 1.0, 1.0)  // Bottom face - Cyan
    ];

    // Helper Function to Create a Face of the Cube
    function quad(a, b, c, d, faceColor) {
        // Push two triangles for each face
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

    // Create the Cube by Defining Each Face
    quad(0, 1, 2, 3, faceColors[0]); // Front face
    quad(1, 5, 6, 2, faceColors[1]); // Right face
    quad(5, 4, 7, 6, faceColors[2]); // Back face
    quad(4, 0, 3, 7, faceColors[3]); // Left face
    quad(3, 2, 6, 7, faceColors[4]); // Top face
    quad(4, 5, 1, 0, faceColors[5]); // Bottom face
}

// Function to Setup All Buffers
function setupBuffers() {
    // Load the Vertex Data into the GPU
    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(positionsArray), gl.STATIC_DRAW);

    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Load the Color Data into the GPU
    cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colorsArray), gl.STATIC_DRAW);

    vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);
}

// Function to Create a 3D Array
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

// Function to Initialize the Grid with Random Alive/Dead Cells
function initializeGrid() {
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let z = 0; z < GRID_SIZE; z++) {
                const isAlive = Math.random() < 0.2 ? 1 : 0;
                grid[x][y][z] = {
                    isAlive: isAlive,
                    size: isAlive ? 1.0 : 0.0 // Start at full size or zero
                };
            }
        }
    }
}

// Function to Count Living Neighbors of a Cell
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

// Function to Compute the Next State of the Grid
function updateGrid() {
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let z = 0; z < GRID_SIZE; z++) {
                const cell = grid[x][y][z];
                const livingNeighbors = countLivingNeighbors(x, y, z);
                let nextIsAlive = cell.isAlive;

                if (cell.isAlive) {
                    // Living Cell Rules
                    if (livingNeighbors >= 5 && livingNeighbors <= 7) {
                        nextIsAlive = 1; // Cell stays alive
                    } else {
                        nextIsAlive = 0; // Cell dies
                    }
                } else {
                    // Dead Cell Rules
                    if (livingNeighbors === 6) {
                        nextIsAlive = 1; // Cell becomes alive
                    } else {
                        nextIsAlive = 0; // Cell stays dead
                    }
                }

                // Update the Next Grid
                nextGrid[x][y][z] = {
                    isAlive: nextIsAlive,
                    size: cell.size // Size will be updated in the render function
                };
            }
        }
    }

    // Swap the Grids
    [grid, nextGrid] = [nextGrid, grid];
}

// Function to Setup Mouse Controls
function setupMouseControls() {
    // Event Listeners for Mouse Interaction
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
        event.preventDefault(); // Prevent the page from scrolling
        zoom -= event.deltaY * 0.05; // Adjust the zoom sensitivity

        // Limit the Zoom Level to Prevent Excessive Zooming
        zoom = Math.min(Math.max(zoom, -100), -5);
    });
}

// Game Loop Function to Update the Grid at Regular Intervals
function gameLoop() {
    let loops = 0;
    const currentTime = Date.now();

    while (currentTime > nextGameTick && loops < maxFrameSkip) {
        updateGrid();
        nextGameTick += skipTicks;
        loops++;
    }

    // Continue the Game Loop
    requestAnimFrame(gameLoop);
}

// Render Function
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Create and Apply the Projection Matrix
    const aspect = canvas.width / canvas.height;
    const projMatrix = perspective(90.0, aspect, 1.0, 10000.0);
    gl.uniformMatrix4fv(uProjectionMatrix, false, flatten(projMatrix));

    // Base Model View Matrix with Zoom and Rotation
    let baseModelViewMatrix = mat4();
    baseModelViewMatrix = mult(baseModelViewMatrix, translate(0, 0, zoom));
    baseModelViewMatrix = mult(baseModelViewMatrix, rotateX(rotationX));
    baseModelViewMatrix = mult(baseModelViewMatrix, rotateY(rotationY));

    // Loop Through the Grid and Draw Cells
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let z = 0; z < GRID_SIZE; z++) {
                const cell = grid[x][y][z];

                // Update Size for Animation
                if (cell.isAlive && cell.size < 1.0) {
                    cell.size = Math.min(cell.size + 0.1, 1.0); // Grow
                } else if (!cell.isAlive && cell.size > 0.0) {
                    cell.size = Math.max(cell.size - 0.1, 0.0); // Shrink
                }

                // Only Draw if the Cell is Visible
                if (cell.size > 0.0) {
                    // Calculate the Position of the Cube
                    let modelViewMatrix = baseModelViewMatrix;
                    modelViewMatrix = mult(
                        modelViewMatrix,
                        translate(
                            x - GRID_SIZE / 2 + 0.5,
                            y - GRID_SIZE / 2 + 0.5,
                            z - GRID_SIZE / 2 + 0.5
                        )
                    );

                    // Apply Scaling Based on Size
                    const scale = cell.size * 0.8; // 0.8 to make cubes smaller than the grid spacing
                    modelViewMatrix = mult(
                        modelViewMatrix,
                        scalem(scale, scale, scale)
                    );

                    gl.uniformMatrix4fv(uModelViewMatrix, false, flatten(modelViewMatrix));

                    // Draw the Cube
                    gl.drawArrays(gl.TRIANGLES, 0, 36);
                }
            }
        }
    }

    // Continue Rendering
    requestAnimFrame(render);
}
