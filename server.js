const PORT = process.env.PORT || 3000;

const io = require('socket.io')(PORT, {
    cors: {
        origin: "*", 
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

    // SISTEMA DE MOVIMENTO SUAVE (Calculado no Servidor)
    socket.on('move', (angle) => {
        const p = players[socket.id];
        if (p) {
            // Velocidade base que diminui conforme o tamanho (massa)
            const speed = Math.max(1.5, 5 - (p.size / 50));
            
            // Calcula a nova posição baseada no ângulo enviado pelo mouse
            p.x += Math.cos(angle) * speed;
            p.y += Math.sin(angle) * speed;

            // Impede o jogador de sair das bordas do mapa
            p.x = Math.max(0, Math.min(MAP_SIZE, p.x));
            p.y = Math.max(0, Math.min(MAP_SIZE, p.y));
            
            // --- Lógica de Colisões dentro do processamento de movimento ---
            
            // Colisão com Comida
            for (let i = foods.length - 1; i >= 0; i--) {
                let f = foods[i];
                let dist = Math.hypot(p.x - f.x, p.y - f.y);
                if (dist < p.size) {
                    p.size += 0.2;
                    foods.splice(i, 1);
                    spawnFood(1);
                }
            }

            // Colisão com outros Jogadores
            Object.values(players).forEach(enemy => {
                if (enemy.id !== socket.id) {
                    let dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                    // Regra: ser 10% maior para comer o outro
                    if (dist < p.size && p.size > enemy.size * 1.1) {
                        p.size += enemy.size * 0.5;
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

// Envia o estado do jogo para todos os jogadores (33 vezes por segundo)
setInterval(() => {
    io.emit('tick', { players, foods });
}, 30);
