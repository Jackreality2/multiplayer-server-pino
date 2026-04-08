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

// Função para gerar Buracos Negros (+50 de massa)
function spawnBlackHoles(amount = 1) {
    for (let i = 0; i < amount; i++) {
        blackHoles.push({ 
            id: Math.random(), 
            x: Math.random() * MAP_SIZE, 
            y: Math.random() * MAP_SIZE 
        });
    }
}

// Inicializa o mapa
spawnFood(400);
spawnBlackHoles(15);

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
        // Avisa a todos que um novo jogador entrou
        io.emit('playerJoined', players[socket.id].name);
    });

    socket.on('move', (angle) => {
        const p = players[socket.id];
        if (p) {
            // Velocidade proporcional ao tamanho
            const speed = Math.max(1.5, 5 - (p.size / 50));
            
            // Atualiza posição
            p.x += Math.cos(angle) * speed;
            p.y += Math.sin(angle) * speed;

            // Limites da Arena
            p.x = Math.max(0, Math.min(MAP_SIZE, p.x));
            p.y = Math.max(0, Math.min(MAP_SIZE, p.y));

            // --- Lógica de Colisões (Otimizada) ---

            // 1. Colisão com Comida
            for (let i = foods.length - 1; i >= 0; i--) {
                const f = foods[i];
                // Math.hypot é mais lento que comparação direta de quadrados, mas para 400 itens é OK
                if (Math.hypot(p.x - f.x, p.y - f.y) < p.size) {
                    p.size += 0.2;
                    foods.splice(i, 1);
                    spawnFood(1);
                }
            }

            // 2. Colisão com Buraco Negro (+50 de massa)
            for (let i = blackHoles.length - 1; i >= 0; i--) {
                const bh = blackHoles[i];
                if (Math.hypot(p.x - bh.x, p.y - bh.y) < p.size + 15) {
                    p.size += 50;
                    blackHoles.splice(i, 1);
                    // Renasce o buraco negro após 5 segundos em outro local
                    setTimeout(() => spawnBlackHoles(1), 5000);
                }
            }

            // 3. Colisão entre Jogadores (Comer)
            const playerArray = Object.values(players);
            for (let i = 0; i < playerArray.length; i++) {
                const enemy = playerArray[i];
                if (enemy.id !== socket.id) {
                    let dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                    // Regra: ser 10% maior que o inimigo
                    if (dist < p.size && p.size > enemy.size * 1.1) {
                        p.size += enemy.size * 0.5;
                        io.to(enemy.id).emit('die');
                        delete players[enemy.id];
                    }
                }
            }
        }
    });

    socket.on('disconnect', () => { 
        delete players[socket.id]; 
    });
});

// Envia atualizações para os clientes. 
// 15ms é ideal para jogos competitivos (aprox. 66 FPS)
setInterval(() => {
    io.emit('tick', { 
        players, 
        foods, 
        blackHoles 
    });
}, 15);
