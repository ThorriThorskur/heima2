var canvas;
var gl;

var bullets = [];  // Array sem geymir byssukúlur
var bulletSpeed = 0.03; // hraði byssukúla
var birds = []; // Arrey sem geymir fugla
var birdSize = 0.05; // stærð fugla
var numBirds = 5; // magn fugla
var score = 0; // stig
var renderLoop; // leikja loopan
var gameOver = false; // Leikur í búinn?

var vertices = [
    vec2(0.0, -0.75),  // Topp punktur
    vec2(-0.05, -0.9),  // Neðri vinstri punktur
    vec2(0.05, -0.9)   // Neðri hægri punktur
];

// Offsets in the buffer for different elements
var bufferOffsets = {
    paddleStart: 0,
    birdsStart: 3,
    bulletsStart: 3 + numBirds * 4,
    scoreLinesStart: 3 + numBirds * 4 + 100 * 4
};

var bufferId;

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }
    
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.8, 0.8, 0.8, 1.0);

    // Load shaders and initialize attribute buffers
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);
    
    // Load the triangle data into the GPU
    bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);

    // Allocate enough space for all vertices (paddle + bullets + birds)
    var totalVertices = 3 + numBirds * 4 + 100 * 4 + 5 * 2; // Paddle (3) + Birds + Max Bullets + Score lines
    gl.bufferData(gl.ARRAY_BUFFER, totalVertices * 2 * 4, gl.DYNAMIC_DRAW); // 2 (x, y) * 4 bytes per float

    // Associate our shader variables with our data buffer
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Event listener for mouse movement
    canvas.addEventListener('mousemove', function(e) {
        updateTrianglePosition(e);
    });

    // Event listener for mouse clicks
    canvas.addEventListener('click', function(e) {
        fireBullet();
    });

    createBirds();

    render();
}

// Uppfærir staðsetingu veiðimanns
function updateTrianglePosition(event) {
    
    var rect = canvas.getBoundingClientRect();
    var mouseX = event.clientX - rect.left;
    var normalizedX = (2 * mouseX / canvas.width) - 1;
    var currentX = vertices[0][0];
    var deltaX = normalizedX - currentX;

    for (var i = 0; i < vertices.length; i++) {
        vertices[i][0] += deltaX;
    }


    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, bufferOffsets.paddleStart * 2 * 4, flatten(vertices));
}

// Skjóta byssu
function fireBullet() {
    var bulletWidth = 0.01;
    var bulletHeight = 0.03;
    var bulletVertices = [
        vec2(vertices[0][0] - bulletWidth / 2, vertices[0][1]), 
        vec2(vertices[0][0] - bulletWidth / 2, vertices[0][1] + bulletHeight), 
        vec2(vertices[0][0] + bulletWidth / 2, vertices[0][1] + bulletHeight), 
        vec2(vertices[0][0] + bulletWidth / 2, vertices[0][1])
    ];

    bullets.push(bulletVertices);
    var bulletOffset = bufferOffsets.bulletsStart + (bullets.length - 1) * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, bulletOffset * 2 * 4, flatten(bulletVertices));
}

// Hreyfir byssukúlur
function moveBullets() {
    for (var i = bullets.length - 1; i >= 0; i--) {
        for (var j = 0; j < bullets[i].length; j++) {
            bullets[i][j][1] += bulletSpeed;
        }

        if (bullets[i][1][1] > 1.0) {
            bullets.splice(i, 1);
        } else {
            var bulletOffset = bufferOffsets.bulletsStart + i * 4;
            gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
            gl.bufferSubData(gl.ARRAY_BUFFER, bulletOffset * 2 * 4, flatten(bullets[i]));
        }
    }
}

function createBirds() {
    for (var i = 0; i < numBirds; i++) {
        birds.push(createNewBird());

        var birdOffset = bufferOffsets.birdsStart + i * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
        gl.bufferSubData(gl.ARRAY_BUFFER, birdOffset * 2 * 4, flatten(birds[i].vertices));
    }
}

// Býr til fugl með handahófskenndan hraða staðsetningu og átt
function createNewBird() {
    var x = Math.random() > 0.5 ? -1.0 : 1.0; // Hægri, Vinstri?
    var y = Math.random() * 0.8 + 0.1; // Handahófkennd hæð
    var speed = Math.random() * 0.01 + 0.005; // Handahófskenndur hraði
    var direction = x < 0 ? 1 : -1; // Sér um að fugl fer í rétta átt

    // Create vertices for the bird
    var birdVertices = [
        vec2(x - birdSize / 2, y - birdSize / 2), // neðra vinstra
        vec2(x - birdSize / 2, y + birdSize / 2), // efra vinstra
        vec2(x + birdSize / 2, y + birdSize / 2), // efra hægra
        vec2(x + birdSize / 2, y - birdSize / 2)  // neðra hægra
    ];

    return { vertices: birdVertices, speed: speed, direction: direction };
}

// Hreyfir fugl og eyðir þegar hann fer af skjánum
function moveBirds() {
    for (var i = 0; i < birds.length; i++) {
        var bird = birds[i];
        
        // Hreyfir fugl
        for (var j = 0; j < bird.vertices.length; j++) {
            bird.vertices[j][0] += bird.speed * bird.direction;
        }

        // Fugl en á skjá?
        var rightMostPoint = bird.vertices[2][0];
        var leftMostPoint = bird.vertices[0][0];

        if ((bird.direction === 1 && leftMostPoint > 1.0) || (bird.direction === -1 && rightMostPoint < -1.0)) {
            // út með gamla inn með nýja
            birds[i] = createNewBird();
        }

        var birdOffset = bufferOffsets.birdsStart + i * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
        gl.bufferSubData(gl.ARRAY_BUFFER, birdOffset * 2 * 4, flatten(birds[i].vertices));
    }
}

function isCollision(bird, bullet) {
    var birdLeft = bird.vertices[0][0];
    var birdRight = bird.vertices[2][0];
    var birdBottom = bird.vertices[0][1];
    var birdTop = bird.vertices[1][1];

    var bulletLeft = bullet[0][0];
    var bulletRight = bullet[2][0];
    var bulletBottom = bullet[0][1];
    var bulletTop = bullet[1][1];

    return !(birdRight < bulletLeft || 
             birdLeft > bulletRight || 
             birdTop < bulletBottom || 
             birdBottom > bulletTop);
}

function handleCollisions() {
    for (var i = bullets.length - 1; i >= 0; i--) {
        for (var j = birds.length - 1; j >= 0; j--) {
            if (isCollision(birds[j], bullets[i])) {
                birds.splice(j, 1);
                bullets.splice(i, 1);
                score++;

                if (score >= 5) {
                    endGame();
                    return;
                }
                //passa að heildar fjöldi fugla minnki ekki þegar einn er skottinn
                birds.push(createNewBird());
                var birdOffset = bufferOffsets.birdsStart + j * 4;
                gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
                gl.bufferSubData(gl.ARRAY_BUFFER, birdOffset * 2 * 4, flatten(birds[j].vertices));

                break;
            }
        }
    }
}

function drawScoreLines() {
    var baseX = -0.9;
    var baseY = 0.9;
    var lineWidth = 0.01;
    var lineHeight = 0.05;
    var gap = 0.01;

   
    for (var i = 0; i < score; i++) {
        var lineVertices = [
            vec2(baseX + i * (lineWidth + gap), baseY),
            vec2(baseX + i * (lineWidth + gap), baseY - lineHeight)
        ];

        var lineOffset = bufferOffsets.scoreLinesStart + (i * 2);
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
        gl.bufferSubData(gl.ARRAY_BUFFER, lineOffset * 2 * 4, flatten(lineVertices));
    }

    for (var i = 0; i < score; i++) {
        var lineOffset = bufferOffsets.scoreLinesStart + (i * 2);
        gl.vertexAttribPointer(gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), "vPosition"), 2, gl.FLOAT, false, 0, lineOffset * 2 * 4);
        gl.drawArrays(gl.LINES, 0, 2);
    }
}

function endGame() {
    // Stoppa leikinn
    gameOver = true;
    cancelAnimationFrame(renderLoop);

    // Leiklokið skilaboð
    var gameOverMessage = document.createElement('div');
    gameOverMessage.id = 'game-over';
    gameOverMessage.style.position = 'absolute';
    gameOverMessage.style.top = canvas.offsetTop + canvas.height / 2 - 24 + 'px';
    gameOverMessage.style.left = canvas.offsetLeft + canvas.width / 2 - 100 + 'px';
    gameOverMessage.style.color = 'black';
    gameOverMessage.style.fontSize = '48px';
    gameOverMessage.style.fontWeight = 'bold';
    gameOverMessage.style.pointerEvents = 'none';
    gameOverMessage.textContent = 'Game Over!';
    document.body.appendChild(gameOverMessage);

    var resetButton = document.createElement('button');
    resetButton.id = 'reset-button';
    resetButton.style.position = 'absolute';
    resetButton.style.top = canvas.offsetTop + canvas.height / 2 + 50 + 'px';
    resetButton.style.left = canvas.offsetLeft + canvas.width / 2 - 50 + 'px';
    resetButton.textContent = 'Restart Game';
    document.body.appendChild(resetButton);

    // Fylgist með reset takkanum
    resetButton.addEventListener('click', function() {
        resetButton.disabled = true;
        resetGame();
    });
}

// Endur stillir allt
function resetGame() {
    score = 0;
    bullets = [];
    birds = [];
    gameOver = false;

    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, bufferOffsets.bulletsStart * 2 * 4, new Float32Array(100 * 4 * 2)); // Clear bullets
    gl.bufferSubData(gl.ARRAY_BUFFER, bufferOffsets.birdsStart * 2 * 4, new Float32Array(numBirds * 4 * 2)); // Clear birds

    createBirds();

    // Drepa reset takkan
    var resetButton = document.getElementById('reset-button');
    if (resetButton) {
        resetButton.remove();
    }

    // Drepa leik lokið skilaboð
    var gameOverMessage = document.getElementById('game-over');
    if (gameOverMessage) {
        gameOverMessage.remove();
    }

    // Endurræsa leikja lúpunni
    render();
}

function render() {
    if (gameOver) {
        return; 
    }

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.vertexAttribPointer(gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), "vPosition"), 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Hreyfa og teikna byssukúllur
    moveBullets();
    for (var i = 0; i < bullets.length; i++) {
        var bulletOffset = bufferOffsets.bulletsStart + i * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
        gl.vertexAttribPointer(gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), "vPosition"), 2, gl.FLOAT, false, 0, bulletOffset * 2 * 4);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    // Hreyfa og teikna fugla
    moveBirds();
    for (var i = 0; i < birds.length; i++) {
        var birdOffset = bufferOffsets.birdsStart + i * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
        gl.vertexAttribPointer(gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), "vPosition"), 2, gl.FLOAT, false, 0, birdOffset * 2 * 4);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    // Teikan stiga prikk
    drawScoreLines();

    handleCollisions();

    // Hægja á leiknum
    setTimeout(function() {
        renderLoop = requestAnimFrame(render);
    }, 1000 / 60); // 60 FPS
}