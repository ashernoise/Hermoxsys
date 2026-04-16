const SB_URL = "https://pkeqkdnzcpknmfydexfr.supabase.co";

const SB_KEY = "sb_publishable_1PIj7d6sK7xdp03Fl3ZWwQ_C75H2H6k";

const _supabase = supabase.createClient(SB_URL, SB_KEY);

let currentUser = null; 

// --- LOGIN E PERMISSÕES ---
async function logar() {
    const cpf = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    if (!cpf) return alert("Digite o CPF");

    const { data: user, error } = await _supabase.from('usuarios').select('*').eq('cpf', cpf).single();
    if (error || !user) return alert("Usuário não encontrado");

    if (!user.senha_hash) {
        const nS = prompt("Primeiro acesso! Crie uma senha:");
        if (nS) {
            await _supabase.from('usuarios').update({ senha_hash: nS }).eq('id', user.id);
            alert("Senha criada! Faça login novamente.");
            location.reload();
        }
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

function aplicarPermissoes() {
    if (currentUser.nivel === 'entregador') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('escondido'));
        document.querySelectorAll('.admin-only-input').forEach(el => el.style.display = 'none');
        mostrar('entregas');
    } else {
        mostrar('home');
    }
}

async function mostrar(id) {
    if (currentUser && currentUser.nivel === 'entregador' && id !== 'entregas') {
        alert("Acesso Negado.");
        return;
    }

    document.querySelectorAll('.secao').forEach(s => s.classList.add('escondido'));
    document.getElementById('sec-' + id).classList.remove('escondido');

    if(id.startsWith('cad-')) {
        const hId = document.getElementById(id.charAt(4) + '-id');
        
        if(hId && !hId.value) {
            const inputs = document.querySelectorAll(`#sec-${id} input:not([readonly]), #sec-${id} select`);
            inputs.forEach(inp => inp.value = '');
            if(id === 'cad-entrega') document.getElementById('ent-qtd').value = 1;
            
            const titulos = {
                'cad-usuario': 'Cadastrar Usuário',
                'cad-paciente': 'Cadastrar Paciente',
                'cad-cilindro': 'Cadastrar Tipo de Cilindro',
                'cad-entrega': 'Registrar Entrega'
            };
            const h2 = document.getElementById('titulo-' + id);
            if (h2) h2.innerText = titulos[id];
        }
    }

    if (id === 'usuarios') carregarUsuarios();
    if (id === 'pacientes') carregarPacientes();
    if (id === 'cilindros') carregarCilindros();
    if (id === 'entregas') carregarTabelaEntregas();
    if (id === 'cad-entrega') carregarSelects();
}

// --- CRUD USUÁRIOS ---
function toggleEmpresa() {
    const n = document.getElementById('u-nivel').value;
    document.getElementById('u-empresa').classList.toggle('escondido', n === 'admin');
}

async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').order('nome');
    document.querySelector('#tbl-usuarios tbody').innerHTML = data.map(i => `
        <tr>
            <td>${i.nome}</td><td>${i.cpf}</td><td>${i.contato || '-'}</td>
            <td>${i.nivel}</td><td>${i.empresa || '-'}</td>
            <td>
                <button onclick="editarUsuario('${i.id}')">✏️</button>
                <button onclick="deletarUsuario('${i.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function salvarUsuario() {
    const id = document.getElementById('u-id').value;
    const d = {
        nome: document.getElementById('u-nome').value,
        cpf: document.getElementById('u-cpf').value,
        contato: document.getElementById('u-contato').value,
        nivel: document.getElementById('u-nivel').value,
        empresa: document.getElementById('u-empresa').value || null
    };

    if (id) {
        await _supabase.from('usuarios').update(d).eq('id', id);
        alert("Usuário Atualizado!");
    } else {
        await _supabase.from('usuarios').insert([d]);
        alert("Usuário Cadastrado!");
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
    document.getElementById('u-contato').value = data.contato || '';
    document.getElementById('u-nivel').value = data.nivel;
    document.getElementById('u-empresa').value = data.empresa || '';
    toggleEmpresa();
    
    document.getElementById('titulo-cad-usuario').innerText = "Editar Usuário";
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
        <tr style="${!i.ativo ? 'background:#f0f0f0; color:#999;' : ''}">
            <td>${i.nome}</td><td>${i.cpf || '-'}</td><td>${i.cartao_sus || '-'}</td>
            <td>${i.ativo ? 'Ativo' : 'Inativo'}</td>
            <td>
                <button onclick="editarPaciente('${i.id}')">✏️</button>
                <button onclick="desativarPaciente('${i.id}', ${i.ativo})">🚫</button>
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

    if(id) {
        await _supabase.from('pacientes').update(d).eq('id', id);
        alert("Paciente Atualizado!");
    } else {
        await _supabase.from('pacientes').insert([d]);
        alert("Paciente Cadastrado!");
    }
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
    
    document.getElementById('titulo-cad-paciente').innerText = "Editar Paciente";
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
        <tr>
            <td>${i.numero_serie}</td>
            <td>${i.tipo}</td>
            <td>${i.capacidade}L</td>
            <td>
                <button onclick="editarCilindro('${i.id}')">✏️</button>
                <button onclick="deletarCilindro('${i.id}')">🗑️</button>
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

    if (id) {
        await _supabase.from('tipos_cilindro').update(d).eq('id', id);
        alert("Cilindro Atualizado!");
    } else {
        await _supabase.from('tipos_cilindro').insert([d]);
        alert("Cilindro Cadastrado!");
    }
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
    
    document.getElementById('titulo-cad-cilindro').innerText = "Editar Cilindro";
    mostrar('cad-cilindro');
}

async function deletarCilindro(id) {
    if(confirm("Excluir definitivamente este tipo de cilindro?")) {
        await _supabase.from('tipos_cilindro').delete().eq('id', id);
        carregarCilindros();
    }
}


// --- CRUD ENTREGAS E RELATÓRIOS ---
async function carregarTabelaEntregas() {
    // Agora puxamos também o campo 'celular' da tabela 'pacientes'
    let query = _supabase.from('entregas').select(`
        id, data_entrega, endereco_entrega, qtd_cilindros, observacoes,
        pacientes (nome, celular), usuarios (nome), tipos_cilindro (tipo, capacidade) 
    `).order('data_entrega', {ascending: false});

    if (currentUser.nivel === 'entregador') query = query.eq('entregador_id', currentUser.id);

    const { data } = await query;
    const tbody = document.querySelector('#tbl-entregas tbody');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Nenhuma entrega.</td></tr>';
        return;
    }
    
    window.dadosExportacao = data;

    tbody.innerHTML = data.map(i => {
        const d = new Date(i.data_entrega).toLocaleString('pt-BR');
        const cilindroTexto = i.tipos_cilindro ? `${i.tipos_cilindro.tipo} (${i.tipos_cilindro.capacidade}L)` : '-';
        
        // Formata o contato do paciente, se não existir, avisa
        const contatoPaciente = i.pacientes?.celular ? i.pacientes.celular : 'Não informado';
        
        let acoesAdmin = '';
        if (currentUser.nivel === 'admin') {
            acoesAdmin = `<td class="admin-only">
                <button onclick="editarEntrega('${i.id}')">✏️</button>
                <button onclick="deletarEntrega('${i.id}')">🗑️</button>
            </td>`;
        }
        
        // Adicionada a célula com o Contato (contatoPaciente)
        return `<tr>
            <td>${d}</td>
            <td>${i.pacientes?.nome || 'N/A'}</td>
            <td>${contatoPaciente}</td>
            <td>${i.endereco_entrega}</td>
            <td>${i.usuarios?.nome || 'Você'}</td>
            <td>${i.qtd_cilindros}x ${cilindroTexto}</td>
            ${acoesAdmin}
        </tr>`;
    }).join('');
}

async function carregarSelects() {
    const p = await _supabase.from('pacientes').select('id, nome').eq('ativo', true);
    const c = await _supabase.from('tipos_cilindro').select('id, tipo, capacidade, numero_serie');
    
    document.getElementById('sel-paciente').innerHTML = '<option value="">Selecione o Paciente...</option>' + p.data.map(i => `<option value="${i.id}">${i.nome}</option>`).join('');
    document.getElementById('sel-cilindro').innerHTML = '<option value="">Selecione o Cilindro...</option>' + c.data.map(i => `<option value="${i.id}">${i.numero_serie} - ${i.tipo} (${i.capacidade}L)</option>`).join('');

    if(currentUser.nivel === 'admin') {
        const u = await _supabase.from('usuarios').select('id, nome').eq('nivel', 'entregador');
        document.getElementById('sel-usuario').innerHTML = '<option value="">Selecione Entregador...</option>' + u.data.map(i => `<option value="${i.id}">${i.nome}</option>`).join('');
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
    const d = { 
        paciente_id: document.getElementById('sel-paciente').value, 
        entregador_id: currentUser.nivel === 'admin' ? document.getElementById('sel-usuario').value : currentUser.id, 
        tipo_cilindro_id: document.getElementById('sel-cilindro').value,
        qtd_cilindros: document.getElementById('ent-qtd').value,
        endereco_entrega: document.getElementById('ent-endereco').value,
        observacoes: document.getElementById('ent-obs').value
    };

    if(!d.paciente_id || !d.tipo_cilindro_id) return alert("Preencha os campos obrigatórios");

    if (id) {
        await _supabase.from('entregas').update(d).eq('id', id);
        alert("Entrega Atualizada!");
    } else {
        await _supabase.from('entregas').insert([d]);
        alert("Entrega Registrada!");
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
    document.getElementById('sel-usuario').value = data.entregador_id;
    document.getElementById('sel-cilindro').value = data.tipo_cilindro_id;
    document.getElementById('ent-qtd').value = data.qtd_cilindros;
    document.getElementById('ent-obs').value = data.observacoes || '';
    document.getElementById('ent-endereco').value = data.endereco_entrega;
    
    document.getElementById('titulo-cad-entrega').innerText = "Editar Entrega";
    mostrar('cad-entrega');
}

async function deletarEntrega(id) {
    if(confirm("Excluir definitivamente o registro desta entrega?")) {
        await _supabase.from('entregas').delete().eq('id', id);
        carregarTabelaEntregas();
    }
}

function exportarCSV() {
    if(!window.dadosExportacao || window.dadosExportacao.length === 0) return alert("Sem dados para exportar.");
    
    let csvContent = "data:text/csv;charset=utf-8,";
    // Adicionado Contato no cabeçalho do CSV
    csvContent += "Data,Paciente,Contato,Endereco,Entregador,Qtd,Cilindro,Obs\n"; 

    window.dadosExportacao.forEach(r => {
        const cilindroTexto = r.tipos_cilindro ? `${r.tipos_cilindro.tipo} (${r.tipos_cilindro.capacidade}L)` : '';
        const contatoPaciente = r.pacientes?.celular || '';

        let row = [
            new Date(r.data_entrega).toLocaleString('pt-BR'),
            r.pacientes?.nome,
            `"${contatoPaciente}"`, // Contato extraído
            `"${r.endereco_entrega}"`, 
            r.usuarios?.nome,
            r.qtd_cilindros,
            `"${cilindroTexto}"`,
            `"${r.observacoes || ''}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio_entregas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function sair() { if(confirm("Sair do sistema?")) location.reload(); }