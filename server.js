const PORT = process.env.PORT || 3000;
const io = require('socket.io')(PORT, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

let players = {};
let foods = [];
let blackHoles = []; // Lista de Buracos Negros
const MAP_SIZE = 5000;

// Função para gerar comida comum
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

// Função para gerar Buracos Negros (Dão +50 de massa)
function spawnBlackHoles(amount = 1) {
    for (let i = 0; i < amount; i++) {
        blackHoles.push({
            id: Math.random(),
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            size: 40 // Tamanho visual do buraco negro
        });
    }
}

// Inicialização do mapa
spawnFood(400);
spawnBlackHoles(15); // Começa com 15 buracos negros espalhados

console.log(`Servidor de PinoCobrinhas Pro rodando na porta ${PORT}`);

io.on('connection', (socket) => {
    console.log(`Novo jogador: ${socket.id}`);

    socket.on('joinGame', (userData) => {
        players[socket.id] = {
            id: socket.id,
            name: userData.name || "Convidado",
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            size: 25,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            skin: userData.skin || null, // URL da foto ou gif
            nameColor: userData.nameColor || "white" // Cor personalizada do nome
        };
    });

    socket.on('move', (angle) => {
        const p = players[socket.id];
        if (p) {
            // Velocidade diminui conforme a massa aumenta
            const speed = Math.max(1.5, 5 - (p.size / 50));
            
            p.x += Math.cos(angle) * speed;
            p.y += Math.sin(angle) * speed;

            // Limites do mapa
            p.x = Math.max(0, Math.min(MAP_SIZE, p.x));
            p.y = Math.max(0, Math.min(MAP_SIZE, p.y));
            
            // --- COLISÕES ---
            
            // 1. Colisão com Comida Comum
            for (let i = foods.length - 1; i >= 0; i--) {
                let f = foods[i];
                if (Math.hypot(p.x - f.x, p.y - f.y) < p.size) {
                    p.size += 0.2;
                    foods.splice(i, 1);
                    spawnFood(1);
                }
            }

            // 2. Colisão com Buraco Negro (+50 de massa)
            for (let i = blackHoles.length - 1; i >= 0; i--) {
                let bh = blackHoles[i];
                if (Math.hypot(p.x - bh.x, p.y - bh.y) < p.size + 10) {
                    p.size += 50; 
                    blackHoles.splice(i, 1);
                    // Renasce o buraco negro em outro lugar após 5 segundos
                    setTimeout(() => spawnBlackHoles(1), 5000);
                }
            }

            // 3. Colisão com outros Jogadores (Comer)
            Object.values(players).forEach(enemy => {
                if (enemy.id !== socket.id) {
                    let dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
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
        delete players[socket.id];
    });
});

// Envio de dados (tick) aumentado para 20ms para maior fluidez
setInterval(() => {
    io.emit('tick', { 
        players, 
        foods, 
        blackHoles 
    });
}, 20);
