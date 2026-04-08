const PORT = process.env.PORT || 3000;
const io = require('socket.io')(PORT, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    } 
});

let players = {};
let foods = [];
let blackHoles = [];
let ejectedMasses = []; // LISTA PARA MASSAS EXPULSAS
const MAP_SIZE = 5000;

// Gerar comida comum
function spawnFood(n) { 
    for(let i=0; i<n; i++) {
        foods.push({
            id: Math.random(), 
            x: Math.random() * MAP_SIZE, 
            y: Math.random() * MAP_SIZE, 
            color: `hsl(${Math.random() * 360}, 80%, 60%)`
        });
    } 
}

// Gerar Buracos Negros
function spawnBH(n) { 
    for(let i=0; i<n; i++) {
        blackHoles.push({
            id: Math.random(), 
            x: Math.random() * MAP_SIZE, 
            y: Math.random() * MAP_SIZE
        });
    } 
}

spawnFood(450); 
spawnBH(18);

console.log(`Servidor de PinoCobrinhas Pro rodando na porta ${PORT}`);

io.on('connection', (socket) => {
    
    socket.on('joinGame', (userData) => {
        players[socket.id] = { 
            id: socket.id, 
            name: userData.name || "Convidado", 
            x: Math.random() * MAP_SIZE, 
            y: Math.random() * MAP_SIZE, 
            size: 25, 
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            skin: userData.skin || null,
            nameColor: userData.nameColor || "white"
        };
        io.emit('playerJoined', players[socket.id].name);
    });

    // EVENTO PARA EXPULSAR MASSA
    socket.on('ejectMass', () => {
        const p = players[socket.id];
        // Só permite ejetar se tiver um tamanho mínimo (ex: 35)
        if (p && p.size > 35) {
            const loss = 2; // Quanto o jogador perde
            p.size -= loss;

            // Adiciona a massa ejetada na posição do jogador
            ejectedMasses.push({
                id: Math.random(),
                x: p.x,
                y: p.y,
                color: p.color,
                size: 12 // Tamanho visual da massa ejetada
            });
        }
    });

    socket.on('move', (angle) => {
        const p = players[socket.id];
        if(!p) return;

        const speed = Math.max(1.5, 5 - (p.size / 50));
        p.x += Math.cos(angle) * speed; 
        p.y += Math.sin(angle) * speed;

        p.x = Math.max(0, Math.min(MAP_SIZE, p.x)); 
        p.y = Math.max(0, Math.min(MAP_SIZE, p.y));

        // 1. Colisão com Comida Comum
        for(let i = foods.length - 1; i >= 0; i--) {
            if(Math.hypot(p.x - foods[i].x, p.y - foods[i].y) < p.size) { 
                p.size += 0.22; 
                foods.splice(i, 1); 
                spawnFood(1); 
            }
        }

        // 2. Colisão com Buracos Negros
        for(let i = blackHoles.length - 1; i >= 0; i--) {
            if(Math.hypot(p.x - blackHoles[i].x, p.y - blackHoles[i].y) < p.size + 15) { 
                p.size += 50; 
                blackHoles.splice(i, 1); 
                setTimeout(() => spawnBH(1), 5000); 
            }
        }

        // 3. Colisão com Massa Ejetada (Recoletar)
        for(let i = ejectedMasses.length - 1; i >= 0; i--) {
            if(Math.hypot(p.x - ejectedMasses[i].x, p.y - ejectedMasses[i].y) < p.size) {
                p.size += 1.5; // Ganha um pouco menos do que o ejetado
                ejectedMasses.splice(i, 1);
            }
        }

        // 4. Colisão entre Jogadores
        const allPlayers = Object.values(players);
        for(let i = 0; i < allPlayers.length; i++) {
            const enemy = allPlayers[i];
            if(enemy.id !== socket.id) {
                let dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if(dist < p.size && p.size > enemy.size * 1.1) {
                    p.size += enemy.size * 0.45; 
                    io.to(enemy.id).emit('die'); 
                    delete players[enemy.id];
                }
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

setInterval(() => {
    io.emit('tick', { players, foods, blackHoles, ejectedMasses });
}, 15);
