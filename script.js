// --- IMPORTAÇÕES DO FIREBASE (Via CDN) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO DO FIREBASE ---
// Substitua os valores abaixo pelos que você pegou no Console do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBHQEJFOBseM54Sq3uQZv6aJWk7PT_iqII",
    authDomain: "sigelab-informatica.firebaseapp.com",
    projectId: "sigelab-informatica",
    storageBucket: "sigelab-informatica.firebasestorage.app",
    messagingSenderId: "217199289166",
    appId: "1:217199289166:web:a817e1903b11f9a108f41f"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const nomeColecao = "agendamentos_lab01"; // Nome da "tabela" no banco

// --- VARIÁVEIS GLOBAIS ---
let cacheAgendamentos = []; // Guarda a cópia local dos dados do banco
let dataAtual = new Date();
let diaSelecionado = null;

const horariosPermitidos = [
    "07:00 - 07:50", "07:50 - 08:40", "08:40 - 09:30", 
    "09:50 - 10:40", "10:40 - 11:30", "11:30 - 12:20",
    "13:00 - 13:50", "13:50 - 14:40", "14:40 - 15:30", 
    "15:50 - 16:40", "16:40 - 17:30", "17:30 - 18:20"
];

// Elementos DOM
const calendarGrid = document.getElementById('calendarGrid');
const calendarTitle = document.getElementById('calendarTitle');
const listaHorariosDia = document.getElementById('listaHorariosDia');
const dataInput = document.getElementById('dataInput');
const form = document.getElementById('formAgendamento');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    // Inicia "escuta" do banco de dados em tempo real
    iniciarOuvinteFirebase();

    // Eventos de Navegação
    btnPrev.addEventListener('click', () => {
        dataAtual.setMonth(dataAtual.getMonth() - 1);
        renderCalendar();
    });
    btnNext.addEventListener('click', () => {
        dataAtual.setMonth(dataAtual.getMonth() + 1);
        renderCalendar();
    });
});

// --- FUNÇÕES DE BANCO DE DADOS (FIREBASE) ---

function iniciarOuvinteFirebase() {
    // Cria uma query ordenando por data
    const q = query(collection(db, nomeColecao), orderBy("data"));

    // onSnapshot roda sempre que algo muda no banco (ou na primeira carga)
    onSnapshot(q, (querySnapshot) => {
        cacheAgendamentos = []; // Limpa cache
        
        querySnapshot.forEach((doc) => {
            cacheAgendamentos.push({
                id: doc.id, // O ID agora é o hash do Firebase
                ...doc.data() // Pega nome, turma, horario, etc
            });
        });

        // Atualiza a tela automaticamente
        renderCalendar();
        if (diaSelecionado) {
            atualizarListaHorarios(diaSelecionado);
        }
    }, (error) => {
        console.error("Erro ao ler dados:", error);
        alert("Erro de conexão com o banco de dados.");
    });
}

// Salvar Agendamento
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const botaoSubmit = form.querySelector('button[type="submit"]');
    botaoSubmit.disabled = true;
    botaoSubmit.textContent = "Salvando...";

    const novoAgendamento = {
        nome: document.getElementById('nome').value,
        data: document.getElementById('dataInput').value,
        horario: document.getElementById('horario').value,
        disciplina: document.getElementById('disciplina').value,
        turma: document.getElementById('turma').value,
        timestamp: new Date().toISOString() // Log de quando foi criado
    };

    if (!novoAgendamento.data) {
        alert("Selecione uma data no calendário.");
        botaoSubmit.disabled = false;
        botaoSubmit.textContent = "Confirmar Agendamento";
        return;
    }

    if (verificarConflito(novoAgendamento)) {
        alert("ERRO: Este horário acabou de ser ocupado por outro professor!");
        botaoSubmit.disabled = false;
        botaoSubmit.textContent = "Confirmar Agendamento";
        return;
    }

    try {
        // Envia para o Firebase
        await addDoc(collection(db, nomeColecao), novoAgendamento);
        
        alert("Agendamento realizado com sucesso!");
        form.reset();
        // Mantém a data selecionada para facilitar novos agendamentos no mesmo dia
        dataInput.value = diaSelecionado; 
        
    } catch (error) {
        console.error("Erro ao gravar:", error);
        alert("Erro ao salvar agendamento.");
    } finally {
        botaoSubmit.disabled = false;
        botaoSubmit.textContent = "Confirmar Agendamento";
    }
});

// Deletar Agendamento
// (Precisamos expor essa função ao escopo global pois ela é chamada no HTML onclick)
window.deletarAgendamento = async function(id) {
    if(confirm("Deseja realmente cancelar este agendamento?")) {
        try {
            await deleteDoc(doc(db, nomeColecao, id));
            // Não precisa chamar render(), o onSnapshot fará isso sozinho!
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao excluir agendamento.");
        }
    }
}

function verificarConflito(novo) {
    // Verifica no cache local se já existe
    return cacheAgendamentos.some(a => a.data === novo.data && a.horario === novo.horario);
}

// --- LÓGICA DE INTERFACE (CALENDÁRIO) ---
// (Praticamente idêntica à anterior, mas lendo de cacheAgendamentos)

function renderCalendar() {
    const year = dataAtual.getFullYear();
    const month = dataAtual.getMonth();

    const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(dataAtual);
    calendarTitle.textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    calendarGrid.innerHTML = "";

    // Espaços vazios
    for (let i = 0; i < firstDayIndex; i++) {
        const div = document.createElement('div');
        div.classList.add('day-cell', 'empty');
        calendarGrid.appendChild(div);
    }

    // Dias
    for (let i = 1; i <= lastDay; i++) {
        const div = document.createElement('div');
        div.classList.add('day-cell');
        
        const diaString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        div.innerHTML = `<span class="day-number">${i}</span>`;
        
        // Verifica visualmente se tem agendamento usando o CACHE
        const agendamentosNoDia = cacheAgendamentos.filter(a => a.data === diaString);
        
        if (agendamentosNoDia.length > 0) {
            const markersDiv = document.createElement('div');
            markersDiv.classList.add('day-markers');
            agendamentosNoDia.slice(0, 5).forEach(() => {
                const marker = document.createElement('div');
                marker.classList.add('marker');
                markersDiv.appendChild(marker);
            });
            div.appendChild(markersDiv);
        }

        if (diaString === diaSelecionado) {
            div.classList.add('selected');
        }

        div.addEventListener('click', () => {
            document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');
            selecionarDia(diaString);
        });

        calendarGrid.appendChild(div);
    }
}

function selecionarDia(dataString) {
    diaSelecionado = dataString;
    dataInput.value = dataString;
    
    const dataFormatada = new Date(dataString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    document.getElementById('dataSelecionadaTexto').textContent = dataFormatada;
    
    atualizarListaHorarios(dataString);
}

function atualizarListaHorarios(data) {
    const agendamentosDoDia = cacheAgendamentos.filter(a => a.data === data);
    listaHorariosDia.innerHTML = '';

    horariosPermitidos.forEach(horario => {
        const agendamento = agendamentosDoDia.find(a => a.horario === horario);
        
        const div = document.createElement('div');
        
        if (agendamento) {
            div.className = 'slot-item ocupado';
            // Passamos o ID (que agora é string hash do firebase) e a data
            div.innerHTML = `
                <div>
                    <strong>${horario}</strong>
                    <br>
                    <small>${agendamento.disciplina} (${agendamento.turma})</small>
                </div>
                <div style="text-align:right">
                    <span class="badge">${agendamento.nome}</span>
                    <br>
                    <button class="btn-delete" style="margin-top:5px; font-size:0.7rem;" onclick="deletarAgendamento('${agendamento.id}')">Cancelar</button>
                </div>
            `;
        } else {
            div.className = 'slot-item livre';
            div.innerHTML = `
                <div><strong>${horario}</strong></div>
                <div style="font-size: 0.8rem; opacity: 0.7;">Disponível</div>
            `;
            div.style.cursor = 'pointer';
            div.onclick = () => {
                document.getElementById('horario').value = horario;
                document.getElementById('nome').focus();
            };
        }
        listaHorariosDia.appendChild(div);
    });
}