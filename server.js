// O Railway define a porta automaticamente, por isso usamos process.env.PORT
const PORT = process.env.PORT || 3000;

const io = require('socket.io')(PORT, {
    cors: {
        origin: "*", // Permite que o InfinityFree se conecte
        methods: ["GET", "POST"]
    }
});

let players = {};
let foods = [];
const MAP_SIZE = 5000;

function spawnFood(amount = 1) {
    for (let i = 0; i < amount; i++) {
        foods.push({
            id: Math.random(),
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            color: `hsl(${Math.random() * 360}, 80%, 60%)`
        });
    }
}

// Inicializa a comida
spawnFood(300);

console.log(`Servidor de PinoCobrinhas rodando na porta ${PORT}`);

io.on('connection', (socket) => {
    console.log(`Novo jogador conectado: ${socket.id}`);

    socket.on('joinGame', (userData) => {
        players[socket.id] = {
            id: socket.id,
            name: userData.name || "Convidado",
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            size: 25,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`
        };
    });

    socket.on('updatePos', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            
            // Lógica de colisão com comida
            for (let i = foods.length - 1; i >= 0; i--) {
                let f = foods[i];
                let dist = Math.hypot(players[socket.id].x - f.x, players[socket.id].y - f.y);
                if (dist < players[socket.id].size) {
                    players[socket.id].size += 0.2;
                    foods.splice(i, 1);
                    spawnFood(1);
                }
            }

            // Lógica de comer outros jogadores
            Object.values(players).forEach(enemy => {
                if (enemy.id !== socket.id) {
                    let dist = Math.hypot(players[socket.id].x - enemy.x, players[socket.id].y - enemy.y);
                    // Regra: ser 10% maior para comer
                    if (dist < players[socket.id].size && players[socket.id].size > enemy.size * 1.1) {
                        players[socket.id].size += enemy.size * 0.5;
                        io.to(enemy.id).emit('die');
                        delete players[enemy.id];
                    }
                }
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Jogador saiu: ${socket.id}`);
        delete players[socket.id];
    });
});

// Envia atualizações para todos os clientes a cada 30ms
setInterval(() => {
    io.emit('tick', { players, foods });
}, 30);
