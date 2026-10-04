const SB_URL = "https://pkeqkdnzcpknmfydexfr.supabase.co";
const SB_KEY = "sb_publishable_1PIj7d6sK7xdp03Fl3ZWwQ_C75H2H6k";
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let currentUser = null; 

// === CONFIGURAÇÃO DA API EMAILJS ===
emailjs.init("SUA_PUBLIC_KEY_AQUI"); 
const EMAILJS_SERVICE_ID = "SEU_SERVICE_ID_AQUI";
const EMAILJS_TEMPLATE_ID = "SEU_TEMPLATE_ID_AQUI";

// --- UTILIDADES E VALIDAÇÃO ---
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    let cpfs = cpf.split('').map(el => +el);
    const rest = (count) => (cpfs.slice(0, count - 12).reduce((soma, el, i) => soma + el * (count - i), 0) * 10) % 11 % 10;
    return rest(10) === cpfs[9] && rest(11) === cpfs[10];
}

function mascararDado(valor, tipo) {
    if (currentUser && currentUser.nivel === 'admin') return valor;
    if (!valor) return "-";
    if (tipo === 'cpf') return `***.***.${valor.slice(-5, -2)}-**`;
    return "********";
}

// === INTEGRAÇÃO 1: API VIACEP ===
async function buscarCEP() {
    let cep = document.getElementById('p-cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    
    try {
        let res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        let data = await res.json();
        
        if (!data.erro) {
            document.getElementById('p-rua').value = data.logradouro;
            document.getElementById('p-bairro').value = data.bairro;
            if(data.localidade) document.getElementById('p-cidade').value = data.localidade;
        } else {
            alert("CEP não encontrado.");
        }
    } catch (error) {
        console.error("Erro ao buscar CEP", error);
    }
}

// === INTEGRAÇÃO 2: API DE E-MAIL (PRIMEIRO ACESSO) ===
let usuarioParaValidar = null;
let codigoGerado = null;

async function logar() {
    const cpf = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    if (!cpf) return alert("Digite o CPF");

    const { data: user, error } = await _supabase.from('usuarios').select('*').eq('cpf', cpf).single();
    if (error || !user) return alert("Usuário não encontrado");

    if (!user.senha_hash) {
        if(!user.email) return alert("Usuário sem e-mail cadastrado. Peça ao admin para atualizar seu cadastro.");
        
        usuarioParaValidar = user;
        document.getElementById('tela-login').classList.add('escondido');
        document.getElementById('tela-primeiro-acesso').classList.remove('escondido');
        document.getElementById('pa-email').value = user.email;
        return;
    }

    if (user.senha_hash === pass) {
        currentUser = user; 
        document.getElementById('tela-login').classList.add('escondido');
        document.getElementById('dashboard').classList.remove('escondido');
        document.getElementById('user-info').innerText = `Logado como: ${user.nome} (${user.nivel})`;
        aplicarPermissoes(); 
    } else {
        alert("Senha incorreta");
    }
}

function cancelarPrimeiroAcesso() {
    document.getElementById('tela-primeiro-acesso').classList.add('escondido');
    document.getElementById('tela-login').classList.remove('escondido');
}

async function enviarCodigoEmail() {
    codigoGerado = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log("=========================================");
    console.log("🔑 CÓDIGO DE RECUPERAÇÃO GERADO:", codigoGerado);
    console.log("=========================================");
    
    alert("MODO TESTE: O código não foi pro e-mail. Aperte F12 e olhe a aba Console para ver o código de 6 dígitos.");
    
    document.getElementById('div-codigo-senha').classList.remove('escondido');
    document.getElementById('btn-enviar-codigo').innerText = "Código Gerado (Ver F12)";
}

async function validarCodigoECriarSenha() {
    const codDigitado = document.getElementById('pa-codigo').value;
    const novaSenha = document.getElementById('pa-senha').value;

    if(codDigitado !== codigoGerado) return alert("Código incorreto!");
    if(novaSenha.length < 4) return alert("Crie uma senha com pelo menos 4 caracteres.");

    const { error } = await _supabase.from('usuarios').update({ senha_hash: novaSenha }).eq('id', usuarioParaValidar.id);
    if (error) return alert("Erro ao salvar senha.");

    alert("Senha criada com sucesso! Faça login.");
    location.reload();
}

function abrirEsqueciSenha() {
    document.getElementById('tela-login').classList.add('escondido');
    document.getElementById('tela-recuperar').classList.remove('escondido');
}
function voltarLogin() {
    document.getElementById('tela-recuperar').classList.add('escondido');
    document.getElementById('tela-login').classList.remove('escondido');
}
async function recuperarSenha() {
    const cpf = document.getElementById('rec-cpf').value;
    const novaSenha = document.getElementById('rec-nova-senha').value;
    if (!cpf || !novaSenha) return alert("Preencha todos os campos");
    const { data, error } = await _supabase.from('usuarios').select('id').eq('cpf', cpf).single();
    if (error || !data) return alert("CPF não encontrado no sistema.");
    await _supabase.from('usuarios').update({ senha_hash: novaSenha }).eq('id', data.id);
    alert("Senha alterada com sucesso!");
    voltarLogin();
}

// --- PERMISSÕES E MENU ---
function aplicarPermissoes() {
    if (currentUser.nivel === 'entregador') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('escondido'));
        document.querySelectorAll('.admin-only-input').forEach(el => el.style.display = 'none');
        const btnNovaEntrega = document.querySelector('button[onclick="mostrar(\'cad-entrega\')"]');
        if (btnNovaEntrega) btnNovaEntrega.classList.remove('admin-only', 'escondido');
        mostrar('entregas');
    } else {
        mostrar('home');
    }
}

async function mostrar(id) {
    if (currentUser && currentUser.nivel === 'entregador' && !['entregas', 'cad-entrega'].includes(id)) {
        alert("Acesso Negado."); return;
    }
    document.querySelectorAll('.secao').forEach(s => s.classList.add('escondido'));
    const section = document.getElementById('sec-' + id);
    if(section) section.classList.remove('escondido');

    if(id.startsWith('cad-')) {
        const hId = document.getElementById(id.charAt(4) + '-id');
        if(hId && !hId.value) {
            const inputs = document.querySelectorAll(`#sec-${id} input:not([readonly]), #sec-${id} select`);
            inputs.forEach(inp => inp.value = '');
            if(id === 'cad-entrega') document.getElementById('ent-qtd').value = 1;
        }
    }
    if (id === 'usuarios') carregarUsuarios();
    if (id === 'pacientes') carregarPacientes();
    if (id === 'cilindros') carregarCilindros();
    if (id === 'entregas') carregarTabelaEntregas();
    if (id === 'cad-entrega') carregarSelects();
    if (id === 'home' && currentUser && currentUser.nivel === 'admin') carregarDashboardHome();
}

// --- CRUD USUÁRIOS ---
function toggleEmpresa() {
    const elNivel = document.getElementById('u-nivel');
    const elEmpresa = document.getElementById('u-empresa');
    if (elNivel && elEmpresa) {
        elEmpresa.classList.toggle('escondido', elNivel.value === 'admin');
    }
}

async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').order('nome');
    document.querySelector('#tbl-usuarios tbody').innerHTML = data.map(i => `
        <tr class="hover:bg-surface-subtle transition-colors border-b border-border-subtle">
            <td class="py-3 px-4 font-semibold text-on-surface">${i.nome}</td>
            <td class="py-3 px-4 font-mono text-text-muted">${mascararDado(i.cpf, 'cpf')}</td>
            <td class="py-3 px-4 text-text-muted">${i.email || '-'}</td>
            <td class="py-3 px-4 text-text-muted">${i.contato || '-'}</td>
            <td class="py-3 px-4"><span class="px-2.5 py-0.5 rounded-full bg-surface-container text-primary font-semibold text-xs uppercase">${i.nivel}</span></td>
            <td class="py-3 px-4 text-center">
                <button onclick="editarUsuario('${i.id}')" class="btn-acao-tbl btn-editar">✏️ Editar</button>
                <button onclick="deletarUsuario('${i.id}')" class="btn-acao-tbl btn-excluir">🗑️ Excluir</button>
            </td>
        </tr>
    `).join('');
}

async function salvarUsuario() {
    const id = document.getElementById('u-id').value;
    const cpfValue = document.getElementById('u-cpf').value;
    if (!validarCPF(cpfValue)) return alert("CPF Inválido!");

    const d = {
        nome: document.getElementById('u-nome').value,
        cpf: cpfValue,
        email: document.getElementById('u-email').value || null,
        contato: document.getElementById('u-contato').value || null,
        nivel: document.getElementById('u-nivel').value,
        empresa: document.getElementById('u-empresa').value || null
    };

    let response;
    if (id) {
        response = await _supabase.from('usuarios').update(d).eq('id', id);
    } else {
        response = await _supabase.from('usuarios').insert([d]);
    }

    if (response.error) {
        return alert("Erro ao salvar usuário: " + response.error.message);
    }

    document.getElementById('u-id').value = ''; 
    mostrar('usuarios');
}

async function editarUsuario(id) {
    const { data } = await _supabase.from('usuarios').select('*').eq('id', id).single();
    if(!data) return;
    document.getElementById('u-id').value = data.id;
    document.getElementById('u-nome').value = data.nome;
    document.getElementById('u-cpf').value = data.cpf;
    document.getElementById('u-email').value = data.email || '';
    document.getElementById('u-contato').value = data.contato || '';
    document.getElementById('u-nivel').value = data.nivel;
    document.getElementById('u-empresa').value = data.empresa || '';
    toggleEmpresa();
    mostrar('cad-usuario');
}

async function deletarUsuario(id) {
    if(confirm("Excluir definitivamente este usuário?")) {
        await _supabase.from('usuarios').delete().eq('id', id);
        carregarUsuarios();
    }
}

// --- CRUD PACIENTES ---
async function carregarPacientes() {
    const { data } = await _supabase.from('pacientes').select('*').order('nome');
    const tbody = document.querySelector('#tbl-pacientes tbody');
    tbody.innerHTML = data.map(i => `
        <tr class="hover:bg-surface-subtle transition-colors border-b border-border-subtle ${!i.ativo ? 'opacity-60 bg-surface-subtle/50' : ''}">
            <td class="py-3 px-4 font-semibold text-on-surface">${i.nome}</td>
            <td class="py-3 px-4 font-mono text-text-muted">${mascararDado(i.cpf, 'cpf')}</td>
            <td class="py-3 px-4 text-text-muted">${i.cartao_sus || '-'}</td>
            <td class="py-3 px-4">
                <span class="badge-status ${i.ativo ? 'badge-ativo' : 'badge-inativo'}">
                    <span class="w-1.5 h-1.5 rounded-full ${i.ativo ? 'bg-tertiary' : 'bg-text-muted'}"></span>
                    ${i.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td class="py-3 px-4 text-center">
                <button onclick="editarPaciente('${i.id}')" class="btn-acao-tbl btn-editar">✏️ Editar</button>
                <button onclick="desativarPaciente('${i.id}', ${i.ativo})" class="btn-acao-tbl btn-excluir">🚫 ${i.ativo ? 'Desativar' : 'Ativar'}</button>
            </td>
        </tr>
    `).join('');
}

async function salvarPaciente() {
    const id = document.getElementById('p-id').value;
    const d = {
        nome: document.getElementById('p-nome').value,
        cpf: document.getElementById('p-cpf').value,
        cartao_sus: document.getElementById('p-sus').value,
        celular: document.getElementById('p-celular').value,
        data_nascimento: document.getElementById('p-nasc').value || null,
        rua: document.getElementById('p-rua').value,
        numero: document.getElementById('p-numero').value,
        bairro: document.getElementById('p-bairro').value,
        cidade: document.getElementById('p-cidade').value
    };
    if(id) await _supabase.from('pacientes').update(d).eq('id', id);
    else await _supabase.from('pacientes').insert([d]);
    document.getElementById('p-id').value = '';
    mostrar('pacientes');
}

async function editarPaciente(id) {
    const { data } = await _supabase.from('pacientes').select('*').eq('id', id).single();
    if(!data) return;
    document.getElementById('p-id').value = data.id;
    document.getElementById('p-nome').value = data.nome;
    document.getElementById('p-cpf').value = data.cpf;
    document.getElementById('p-sus').value = data.cartao_sus;
    document.getElementById('p-celular').value = data.celular || '';
    document.getElementById('p-nasc').value = data.data_nascimento;
    document.getElementById('p-rua').value = data.rua || '';
    document.getElementById('p-numero').value = data.numero || '';
    document.getElementById('p-bairro').value = data.bairro || '';
    mostrar('cad-paciente');
}

async function desativarPaciente(id, statusAtual) {
    if(confirm(`Deseja ${statusAtual ? 'desativar' : 'ativar'} este paciente?`)){
        await _supabase.from('pacientes').update({ ativo: !statusAtual }).eq('id', id);
        carregarPacientes();
    }
}

// --- CRUD CILINDROS ---
async function carregarCilindros() {
    const { data } = await _supabase.from('tipos_cilindro').select('*').order('numero_serie');
    document.querySelector('#tbl-cilindros tbody').innerHTML = data.map(i => `
        <tr class="hover:bg-surface-subtle transition-colors border-b border-border-subtle">
            <td class="py-3 px-4 font-mono font-semibold text-primary">${i.numero_serie}</td>
            <td class="py-3 px-4 text-on-surface font-medium">${i.tipo}</td>
            <td class="py-3 px-4 text-text-muted">${i.capacidade}L</td>
            <td class="py-3 px-4 text-center">
                <button onclick="editarCilindro('${i.id}')" class="btn-acao-tbl btn-editar">✏️ Editar</button>
                <button onclick="deletarCilindro('${i.id}')" class="btn-acao-tbl btn-excluir">🗑️ Excluir</button>
            </td>
        </tr>
    `).join('');
}

async function salvarCilindro() {
    const id = document.getElementById('c-id').value;
    const d = {
        numero_serie: document.getElementById('c-serie').value,
        tipo: document.getElementById('c-tipo').value,
        capacidade: document.getElementById('c-capacidade').value
    };
    if (id) await _supabase.from('tipos_cilindro').update(d).eq('id', id);
    else await _supabase.from('tipos_cilindro').insert([d]);
    document.getElementById('c-id').value = '';
    mostrar('cilindros');
}

async function editarCilindro(id) {
    const { data } = await _supabase.from('tipos_cilindro').select('*').eq('id', id).single();
    if(!data) return;
    document.getElementById('c-id').value = data.id;
    document.getElementById('c-serie').value = data.numero_serie;
    document.getElementById('c-tipo').value = data.tipo;
    document.getElementById('c-capacidade').value = data.capacidade;
    mostrar('cad-cilindro');
}

async function deletarCilindro(id) {
    if(confirm("Excluir?")) {
        await _supabase.from('tipos_cilindro').delete().eq('id', id);
        carregarCilindros();
    }
}

// --- CRUD ENTREGAS ---
async function carregarTabelaEntregas() {
    let query = _supabase.from('entregas').select(`
        id, data_entrega, endereco_entrega, qtd_cilindros, observacoes,
        pacientes (nome, celular), usuarios (nome), tipos_cilindro (tipo, capacidade) 
    `).order('data_entrega', {ascending: false});

    if (currentUser.nivel === 'entregador') {
        query = query.or(`entregador_id.eq.${currentUser.id},entregador_id.is.null`);
    }

    const { data, error } = await query;
    
    if (error) {
        console.error("Erro ao buscar entregas:", error);
        return alert("Erro ao carregar entregas.");
    }

    const tbody = document.querySelector('#tbl-entregas tbody');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-text-muted">Nenhuma entrega cadastrada.</td></tr>';
        return;
    }
    
    window.dadosExportacao = data;

    tbody.innerHTML = data.map(i => {
        const d = new Date(i.data_entrega).toLocaleString('pt-BR');
        const cilindroTexto = i.tipos_cilindro ? `${i.tipos_cilindro.tipo} (${i.tipos_cilindro.capacidade}L)` : '-';
        
        const enderecoLink = `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.endereco_entrega)}" target="_blank" class="text-primary hover:underline font-semibold flex items-center gap-1">📍 ${i.endereco_entrega}</a>`;
        
        let btnWhatsApp = '';
        if(i.pacientes?.celular) {
            let numLimpo = i.pacientes.celular.replace(/\D/g, '');
            let msg = encodeURIComponent(`Olá ${i.pacientes.nome}! Sua entrega de cilindro de oxigênio pelo Hermoxsys acaba de ser registrada e será enviada.`);
            btnWhatsApp = `<a href="https://wa.me/55${numLimpo}?text=${msg}" target="_blank" class="inline-flex items-center gap-1 bg-status-success-bg text-status-success-text px-2 py-0.5 rounded-md text-xs font-semibold hover:opacity-90 ml-2">💬 Avisar</a>`;
        }

        let acoesAdmin = '';
        if (currentUser.nivel === 'admin') {
            acoesAdmin = `<td class="py-3 px-4 text-center admin-only">
                <button onclick="editarEntrega('${i.id}')" class="btn-acao-tbl btn-editar">✏️ Editar</button>
                <button onclick="deletarEntrega('${i.id}')" class="btn-acao-tbl btn-excluir">🗑️ Excluir</button>
            </td>`;
        }
        
        return `<tr class="hover:bg-surface-subtle transition-colors border-b border-border-subtle">
            <td class="py-3 px-4 text-text-muted font-medium">${d}</td>
            <td class="py-3 px-4 font-semibold text-on-surface">${i.pacientes?.nome || 'N/A'} ${btnWhatsApp}</td>
            <td class="py-3 px-4">${enderecoLink}</td>
            <td class="py-3 px-4 text-text-muted">${i.usuarios?.nome || 'Não Atribuído'}</td>
            <td class="py-3 px-4"><span class="px-2 py-1 rounded bg-surface-subtle font-semibold text-on-surface text-xs">${i.qtd_cilindros}x ${cilindroTexto}</span></td>
            ${acoesAdmin}
        </tr>`;
    }).join('');
}

async function carregarSelects() {
    const p = await _supabase.from('pacientes').select('id, nome').eq('ativo', true);
    const c = await _supabase.from('tipos_cilindro').select('id, tipo, capacidade, numero_serie');
    document.getElementById('sel-paciente').innerHTML = '<option value="">Selecione...</option>' + p.data.map(i => `<option value="${i.id}">${i.nome}</option>`).join('');
    document.getElementById('sel-cilindro').innerHTML = '<option value="">Selecione...</option>' + c.data.map(i => `<option value="${i.id}">${i.numero_serie} - ${i.tipo}</option>`).join('');
    if(currentUser.nivel === 'admin') {
        const u = await _supabase.from('usuarios').select('id, nome').eq('nivel', 'entregador');
        document.getElementById('sel-usuario').innerHTML = '<option value="">Entregador...</option>' + u.data.map(i => `<option value="${i.id}">${i.nome}</option>`).join('');
    }
}

async function puxarEnderecoPaciente() {
    const id = document.getElementById('sel-paciente').value;
    if(!id) return;
    const { data } = await _supabase.from('pacientes').select('rua, numero, bairro').eq('id', id).single();
    if (data) document.getElementById('ent-endereco').value = `${data.rua}, ${data.numero}, ${data.bairro}`;
}

async function salvarEntrega() {
    const id = document.getElementById('e-id').value;
    
    let entregadorSelecionado = document.getElementById('sel-usuario').value;
    let entregadorFinal = currentUser.nivel === 'admin' ? (entregadorSelecionado || null) : currentUser.id;

    const d = { 
        paciente_id: document.getElementById('sel-paciente').value, 
        entregador_id: entregadorFinal, 
        tipo_cilindro_id: document.getElementById('sel-cilindro').value,
        qtd_cilindros: document.getElementById('ent-qtd').value,
        endereco_entrega: document.getElementById('ent-endereco').value,
        observacoes: document.getElementById('ent-obs').value || null
    };
    
    if(!d.paciente_id || !d.tipo_cilindro_id) return alert("Preencha os campos obrigatórios");

    let response;
    if (id) {
        response = await _supabase.from('entregas').update(d).eq('id', id);
    } else {
        response = await _supabase.from('entregas').insert([d]);
    }

    if (response.error) {
        return alert("Erro ao salvar entrega: " + response.error.message);
    }

    document.getElementById('e-id').value = '';
    mostrar('entregas');
}

async function editarEntrega(id) {
    await carregarSelects(); 
    const { data } = await _supabase.from('entregas').select('*').eq('id', id).single();
    if(!data) return;
    document.getElementById('e-id').value = data.id;
    document.getElementById('sel-paciente').value = data.paciente_id;
    if (currentUser.nivel === 'admin') document.getElementById('sel-usuario').value = data.entregador_id;
    document.getElementById('sel-cilindro').value = data.tipo_cilindro_id;
    document.getElementById('ent-qtd').value = data.qtd_cilindros;
    document.getElementById('ent-obs').value = data.observacoes || '';
    document.getElementById('ent-endereco').value = data.endereco_entrega;
    mostrar('cad-entrega');
}

async function deletarEntrega(id) {
    if(confirm("Excluir?")) {
        await _supabase.from('entregas').delete().eq('id', id);
        carregarTabelaEntregas();
    }
}

function exportarCSV() {
    if(!window.dadosExportacao || window.dadosExportacao.length === 0) return alert("Sem dados");
    let csvContent = "data:text/csv;charset=utf-8,Data,Paciente,Endereco,Entregador,Qtd,Cilindro,Obs\n"; 
    window.dadosExportacao.forEach(r => {
        let row = [
            new Date(r.data_entrega).toLocaleString('pt-BR'),
            r.pacientes?.nome, `"${r.endereco_entrega}"`, r.usuarios?.nome,
            r.qtd_cilindros, `"${r.tipos_cilindro ? r.tipos_cilindro.tipo : ''}"`, `"${r.observacoes || ''}"`
        ];
        csvContent += row.join(",") + "\n";
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "relatorio_entregas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function sair() { if(confirm("Sair do sistema?")) location.reload(); }

// === INTEGRAÇÃO 5: DASHBOARD (MAPA E GRÁFICO) ===
let mapaLeaflet = null;
let graficoChart = null;

async function carregarDashboardHome() {
    const { data: entregas, error: errEntregas } = await _supabase
        .from('entregas')
        .select(`
            id, 
            qtd_cilindros, 
            observacoes, 
            endereco_entrega, 
            pacientes(bairro, cidade), 
            tipos_cilindro(capacidade)
        `)
        .order('data_entrega', { ascending: false });

    const { count: pacientesAtivos } = await _supabase
        .from('pacientes')
        .select('id', { count: 'exact', head: true })
        .eq('ativo', true);

    const temDados = entregas && entregas.length > 0;

    let totalEntregas = temDados ? entregas.length : 0;
    let totalCilindros = 0;
    let volumeLITROS = 0;
    let ocorrencias = 0;

    const palavrasAlerta = ['não', 'nao', 'ausente', 'fechado', 'recusad', 'problema', 'troca', 'urgente', 'avariad', 'atraso'];

    if (temDados) {
        entregas.forEach(item => {
            const qtd = Number(item.qtd_cilindros || 1);
            totalCilindros += qtd;

            if (item.tipos_cilindro && item.tipos_cilindro.capacidade) {
                const capL = parseFloat(item.tipos_cilindro.capacidade.toString().replace(',', '.')) || 0;
                volumeLITROS += (capL * qtd);
            }

            if (item.observacoes && item.observacoes.trim() !== '') {
                const obsMinusculo = item.observacoes.toLowerCase();
                const ehAlerta = palavrasAlerta.some(palavra => obsMinusculo.includes(palavra));
                
                if (ehAlerta) {
                    ocorrencias++;
                }
            }
        });
    }

    let volumeM3 = volumeLITROS / 1000;

    let textoVolume = volumeM3 >= 0.1 
        ? `${volumeM3.toFixed(2)} m³ acumulados` 
        : `${volumeLITROS} Litros (${volumeM3.toFixed(3)} m³)`;

    const elTotalEntregas = document.getElementById('kpi-total-entregas');
    const elTotalCilindros = document.getElementById('kpi-total-cilindros');
    const elVolumeM3 = document.getElementById('kpi-volume-m3');
    const elPacientesAtivos = document.getElementById('kpi-pacientes-ativos');
    const elOcorrencias = document.getElementById('kpi-ocorrencias');

    if (elTotalEntregas) elTotalEntregas.innerText = totalEntregas;
    if (elTotalCilindros) elTotalCilindros.innerText = totalCilindros;
    if (elVolumeM3) elVolumeM3.innerText = textoVolume;
    if (elPacientesAtivos) elPacientesAtivos.innerText = pacientesAtivos || 0;
    if (elOcorrencias) elOcorrencias.innerText = ocorrencias;

    let labelsBairros = ['Nenhuma entrega'];
    let valoresBairros = [1];
    let cores = ['#e0e0e0'];

    if (temDados) {
        const contagemBairros = {};
        entregas.forEach(item => {
            let bairro = item.pacientes?.bairro || 'Não informado';
            contagemBairros[bairro] = (contagemBairros[bairro] || 0) + 1;
        });
        labelsBairros = Object.keys(contagemBairros);
        valoresBairros = Object.values(contagemBairros);
        cores = ['#004ac6', '#006329', '#2563eb', '#1d4ed8', '#ca8a04', '#dc2626'];
    }

    if (graficoChart) graficoChart.destroy();
    
    const canvasGrafico = document.getElementById('graficoEntregas');
    if (canvasGrafico) {
        const ctx = canvasGrafico.getContext('2d');
        graficoChart = new Chart(ctx, {
            type: 'doughnut', 
            data: {
                labels: labelsBairros,
                datasets: [{
                    data: valoresBairros,
                    backgroundColor: cores,
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const containerMapa = document.getElementById('mapaEntregas');
    if (containerMapa) {
        if (!mapaLeaflet) {
            mapaLeaflet = L.map('mapaEntregas').setView([-23.3615, -46.7328], 11);
            
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri',
                maxZoom: 18
            }).addTo(mapaLeaflet);
        }

        mapaLeaflet.eachLayer(layer => {
            if (layer instanceof L.Marker) mapaLeaflet.removeLayer(layer);
        });

        if (!temDados) return;

        const ultimasEntregas = entregas.slice(0, 5);
        for (let entrega of ultimasEntregas) {
            let cidade = entrega.pacientes?.cidade || 'Caieiras';
            let enderecoCompleto = `${entrega.endereco_entrega}, ${cidade}, SP, Brasil`;
            let enderecoQuery = encodeURIComponent(enderecoCompleto);
            
            try {
                let res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${enderecoQuery}&limit=1`, {
                    headers: {
                        'User-Agent': 'HermoxsysApp/1.0 (gestao@hermoxsys.local)'
                    }
                });
                let latLonData = await res.json();
                
                if (latLonData && latLonData.length > 0) {
                    let lat = latLonData[0].lat;
                    let lon = latLonData[0].lon;
                    
                    L.marker([lat, lon]).addTo(mapaLeaflet)
                      .bindPopup(`<b>Entrega Recente:</b><br>${entrega.endereco_entrega}`);
                      
                    mapaLeaflet.setView([lat, lon], 12);
                }
            } catch (error) {
                console.error("Erro ao buscar coordenadas:", entrega.endereco_entrega);
            }
        }
    }
}