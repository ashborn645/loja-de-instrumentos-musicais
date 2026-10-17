document.addEventListener('DOMContentLoaded', () => {
    // Cada inicialização é isolada: se uma falhar, as outras continuam funcionando
    [initMenuDropdown, initCarrossel, initCarrinho, initBusca, initDestaques, initGradeProdutos]
        .forEach(inicializar => {
            try {
                inicializar();
            } catch (erro) {
                console.error(`Falha ao inicializar ${inicializar.name}:`, erro);
            }
        });
});

function initMenuDropdown() {
    document.querySelectorAll('.dropdown').forEach((dropdown, indice) => {
        const botao = dropdown.querySelector('.menu-dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');
        if (!botao || !menu) return;

        menu.id = `menu-instrumentos-${indice}`;
        botao.setAttribute('aria-controls', menu.id);

        // O menu também abre via :hover (CSS), então o aria-expanded é sincronizado
        // com o estado REAL de visibilidade (classe .aberto ou hover do mouse)
        const sincronizarAria = () => {
            const visivel = dropdown.classList.contains('aberto') || dropdown.matches(':hover');
            botao.setAttribute('aria-expanded', String(visivel));
        };

        const fecharMenu = () => {
            dropdown.classList.remove('aberto');
            sincronizarAria();
        };

        botao.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('aberto');
            sincronizarAria();
        });

        dropdown.addEventListener('mouseleave', sincronizarAria);

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) fecharMenu();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') fecharMenu();
        });
    });
}

// UTILITÁRIOS

// Função de Debounce (Performance na pesquisa)
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

// Função de Feedback Visual (UX - Toast)
function mostrarNotificacao(mensagem) {
    // Remove avisos anteriores para não empilhar vários toasts na mesma posição
    document.querySelectorAll('.toast-notificacao').forEach(toastAntigo => toastAntigo.remove());

    const toast = document.createElement('div');
    toast.className = 'toast-notificacao';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = mensagem;
    document.body.appendChild(toast);
    
    // Força o reflow para garantir a animação
    requestAnimationFrame(() => {
        toast.classList.add('mostrar');
    });

    setTimeout(() => {
        toast.classList.remove('mostrar');
        setTimeout(() => toast.remove(), 300); // Tempo da transição CSS
    }, 3000);
}

//1. CARROSSEL
function initCarrossel() {
    const carrossel = document.getElementById('carrossel');
    const btnEsquerda = document.getElementById('btn-esquerda');
    const btnDireita = document.getElementById('btn-direita');

    // Largura real de um item + espaçamento (gap), para manter o alinhamento
    // do carrossel a cada clique (antes era um valor fixo de 175px)
    const obterLarguraDeslocamento = () => {
        if (!carrossel) return 175;
        const item = carrossel.querySelector('.item-categoria-circular');
        if (!item) return 175;
        const grade = carrossel.querySelector('.grade-categorias-circulares');
        const gap = grade ? (parseFloat(getComputedStyle(grade).gap) || 0) : 0;
        return item.getBoundingClientRect().width + gap;
    };

    if (carrossel && btnEsquerda && btnDireita) {
        // Atualiza estado dos botões de acordo com o scroll (UX)
        const atualizarBotoesCarrossel = () => {
            btnEsquerda.disabled = carrossel.scrollLeft <= 0;
            // Usa Math.ceil para evitar problemas com pixels fracionados
            btnDireita.disabled = Math.ceil(carrossel.scrollLeft + carrossel.clientWidth) >= carrossel.scrollWidth;
        };

        btnDireita.addEventListener('click', () => {
            carrossel.scrollBy({ left: obterLarguraDeslocamento(), behavior: 'smooth' });
        });
        
        btnEsquerda.addEventListener('click', () => {
            carrossel.scrollBy({ left: -obterLarguraDeslocamento(), behavior: 'smooth' });
        });

        carrossel.addEventListener('scroll', atualizarBotoesCarrossel);
        window.addEventListener('resize', atualizarBotoesCarrossel);
        
        // Timeout pequeno para aguardar renderização inicial das fontes/imagens
        setTimeout(atualizarBotoesCarrossel, 100);
    }
}

// 2. CARRINHO DE INTERESSE 
const CHAVE_CARRINHO_INTERESSE = 'flowmusic_carrinho_interesse';

const protocolosCarrinhoPermitidos = new Set(['file:', 'http:', 'https:']);

const normalizarUrlCarrinho = (valor) => {
    if (typeof valor !== 'string' || valor.trim() === '') return null;

    try {
        const url = new URL(valor, window.location.href);
        return protocolosCarrinhoPermitidos.has(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
};

const normalizarItemCarrinho = (item) => {
    const origem = typeof item === 'string' ? { nome: item, link: item } : item;
    if (!origem || typeof origem !== 'object') return null;

    const link = normalizarUrlCarrinho(origem.link);
    if (!link) return null;

    const nome = typeof origem.nome === 'string' && origem.nome.trim() ? origem.nome.trim() : link;
    const foto = normalizarUrlCarrinho(origem.foto);
    return { nome, link, foto };
};

const escaparHtml = (valor) => String(valor).replace(/[&<>"']/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
})[caractere]);

const lerCarrinhoInteresse = () => {
    try {
        const dados = JSON.parse(localStorage.getItem(CHAVE_CARRINHO_INTERESSE)) || [];
        return Array.isArray(dados) ? dados.map(normalizarItemCarrinho).filter(Boolean) : [];
    } catch (erro) {
        return [];
    }
};

const salvarCarrinhoInteresse = (lista) => {
    try {
        localStorage.setItem(CHAVE_CARRINHO_INTERESSE, JSON.stringify(lista));
    } catch (erro) {
        console.warn('Não foi possível salvar o carrinho de interesse:', erro);
    }
};

const atualizarContadorCarrinho = () => {
    const contador = lerCarrinhoInteresse().length;
    document.querySelectorAll('.carrinho-contador').forEach(span => {
        span.textContent = contador;
    });
};

function initCarrinho() {
    atualizarContadorCarrinho();

    document.addEventListener('click', (e) => {
        const linkOrcamento = e.target.closest('.btn-orcamento');
        if (!linkOrcamento) return;

        // Link real do produto (o próprio elemento ou um <a> ancestral, no caso
        // do botão gerado na home, que fica dentro do <a> do card)
        const linkNatual = linkOrcamento.matches('a[href]')
            ? linkOrcamento
            : linkOrcamento.closest('a[href]');

        const destino = (linkOrcamento.getAttribute('href') || linkNatual?.getAttribute('href') || '').trim();
        const semDestino = !destino || destino === '#';
        const idProduto = semDestino ? null : normalizarUrlCarrinho(destino);

        if (idProduto) {
            const nomeProduto = linkOrcamento.dataset.nome || linkNatual?.dataset.nome || idProduto;
            const fotoProduto = normalizarUrlCarrinho(linkOrcamento.dataset.foto || linkNatual?.dataset.foto);

            const carrinho = lerCarrinhoInteresse();
            if (!carrinho.some(item => item.link === idProduto)) {
                carrinho.push({ nome: nomeProduto, link: idProduto, foto: fotoProduto });
                salvarCarrinhoInteresse(carrinho);
                atualizarContadorCarrinho();
                mostrarNotificacao('Produto adicionado à tua lista!');
            } else {
                mostrarNotificacao('Este produto já está na tua lista.');
            }
        }

        if (semDestino || !linkNatual) return;

        // Link real com target="_blank": deixa o navegador abrir naturalmente.
        // Assim, mesmo com bloqueador de pop-up ativo, o produto é aberto.
        if (linkNatual === linkOrcamento && linkNatual.target === '_blank') return;

        // Clique com modificadores (ctrl/shift/etc): repassa ao navegador
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

        // Botão sem navegação própria (ex.: "Consultar Preço" dentro do card da
        // home): cancela a navegação na página atual e abre em nova aba
        e.preventDefault();
        window.open(linkNatual.href, '_blank', 'noopener,noreferrer');
    });

    document.querySelectorAll('.carrinho-icone').forEach((icone, indiceIcone) => {
        const painel = document.createElement('div');
        painel.className = 'carrinho-painel';
        painel.id = `carrinho-painel-${indiceIcone}`;
        painel.setAttribute('aria-label', 'Produtos de interesse');
        const hostPainel = icone.closest('.carrinho-wrapper') || icone.parentElement;
        hostPainel.appendChild(painel);
        icone.setAttribute('aria-controls', painel.id);
        icone.setAttribute('aria-expanded', 'false');

        const renderizarPainelCarrinho = () => {
            const carrinho = lerCarrinhoInteresse();

            if (carrinho.length === 0) {
                painel.innerHTML = '<p class="carrinho-painel-vazio">Nenhum produto de interesse ainda.</p>';
                return;
            }

            painel.innerHTML = `
                <p class="carrinho-painel-titulo">Produtos de interesse</p>
                <ul class="carrinho-painel-lista">
                    ${carrinho.map((item, indice) => {
                        const nome = escaparHtml(item.nome);
                        const link = escaparHtml(item.link);
                        const foto = item.foto ? escaparHtml(item.foto) : null;

                        return `
                        <li>
                            <a href="${link}" target="_blank" rel="noopener noreferrer" class="carrinho-painel-item">
                                ${foto
                                    ? `<img src="${foto}" alt="${nome}" class="carrinho-painel-foto" onerror="this.src='https://placehold.co/100x100'">`
                                    : `<span class="carrinho-painel-foto carrinho-painel-foto-vazia"><i class="bi bi-image"></i></span>`
                                }
                                <span class="carrinho-painel-nome">${nome}</span>
                            </a>
                            <button type="button" class="carrinho-remover" data-indice="${indice}" aria-label="Remover">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </li>
                    `;
                    }).join('')}
                </ul>
            `;
        };

        const fecharPainel = () => {
            painel.classList.remove('aberto');
            icone.setAttribute('aria-expanded', 'false');
        };

        icone.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            renderizarPainelCarrinho();
            const aberto = painel.classList.toggle('aberto');
            icone.setAttribute('aria-expanded', String(aberto));
        });

        painel.addEventListener('click', (e) => {
            const btnRemover = e.target.closest('.carrinho-remover');
            if (!btnRemover) return;
            e.preventDefault();
            e.stopPropagation();

            const indice = Number(btnRemover.dataset.indice);
            const carrinho = lerCarrinhoInteresse();
            carrinho.splice(indice, 1);
            salvarCarrinhoInteresse(carrinho);
            atualizarContadorCarrinho();
            renderizarPainelCarrinho();
            mostrarNotificacao('Produto removido.'); // UX Feedback
        });

        document.addEventListener('click', (e) => {
            if (!icone.contains(e.target) && !painel.contains(e.target)) {
                fecharPainel();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                fecharPainel();
            }
        });
    });
}

// 3. DADOS DE BUSCA E PRODUTOS
// Base do projeto derivada da localização deste script (pasta js/), em vez de
// depender do caminho da página — mais robusta se a pasta raiz mudar de nome
const urlRaizProjeto = (document.currentScript && document.currentScript.src)
    ? new URL('../', document.currentScript.src)
    : new URL('./', window.location.href);

const prefixoPasta = urlRaizProjeto.href;                  // imagens: <raiz>img/...
const linkPrefixo = new URL('html/', urlRaizProjeto).href; // páginas: <raiz>html/...

const dadosBusca = {
    sugestoes: [
        { texto: 'piano', link: linkPrefixo + 'piano.html' },
        { texto: 'teclado', link: linkPrefixo + 'teclado.html' },
        { texto: 'violão', link: linkPrefixo + 'violao.html' },
        { texto: 'guitarra', link: linkPrefixo + 'guitarra.html' },
        { texto: 'baixo', link: linkPrefixo + 'baixo.html' },
        { texto: 'bateria', link: linkPrefixo + 'bateria.html' },
        { texto: 'saxofone', link: linkPrefixo + 'saxofone.html' },
        { texto: 'trompete', link: linkPrefixo + 'trompete.html' },
        { texto: 'acordeon', link: linkPrefixo + 'acordeon.html' },
        { texto: 'violino', link: linkPrefixo + 'violino.html' },
        { texto: 'ukulele', link: linkPrefixo + 'ukulele.html' },
        { texto: 'flauta', link: linkPrefixo + 'flauta.html' },
        { texto: 'acessórios', link: linkPrefixo + 'acessorios.html' }
    ],
    produtos: [
        { nome: 'Piano Digital Portátil FP-30X', foto: prefixoPasta + 'img/piano_digital.jpg', link: linkPrefixo + 'piano.html', categoria: 'piano' },
        { nome: 'Piano Acústico Vertical U1', foto: prefixoPasta + 'img/piano_acustico.webp', link: linkPrefixo + 'piano.html', categoria: 'piano' },
        { nome: 'Piano de Cauda Modelo D-274', foto: prefixoPasta + 'img/piano_de_cauda.jpg', link: linkPrefixo + 'piano.html', categoria: 'piano' },
        { nome: 'Violão Hertom J45 Stage - Sunburst RW', foto: prefixoPasta + 'img/violao_hertom_j45_stage_sunburst_rw.webp', link: linkPrefixo + 'violao.html', categoria: 'violão' },
        { nome: 'Violão Nylon Tagima Vegas Gran Reserva - Dark Mahogany OP', foto: prefixoPasta + 'img/violao_nylon_tagima_vegas_gran_reserva_dark_mahogany_op.webp', link: linkPrefixo + 'violao.html', categoria: 'violão' },
        { nome: 'Violão Yamaha C70 Classico', foto: prefixoPasta + 'img/violao_yamaha_c70_classico.webp', link: linkPrefixo + 'violao.html', categoria: 'violão' },
        { nome: 'Guitarra Michael GM217N SK', foto: prefixoPasta + 'img/guitarra_michael_gm217n_sk.webp', link: linkPrefixo + 'guitarra.html', categoria: 'guitarra' },
        { nome: 'Guitarra Strinberg STS100 BKS Fosco', foto: prefixoPasta + 'img/guitarra_strinberg_sts100_bks_fosco.webp', link: linkPrefixo + 'guitarra.html', categoria: 'guitarra' },
        { nome: 'Guitarra Elétrica Yamaha Revstar RS-E20-BL', foto: prefixoPasta + 'img/guitarra_yamaha_revstar_rs_e20_bl.webp', link: linkPrefixo + 'guitarra.html', categoria: 'guitarra' },
        { nome: 'Flauta Doce Soprano Germ YRS-23G', foto: prefixoPasta + 'img/flauta_doce_soprano_germ_yrs_23_g.webp', link: linkPrefixo + 'flauta.html', categoria: 'flauta' },
        { nome: 'Flauta Doce Soprano Bar YRS-302B III', foto: prefixoPasta + 'img/flauta_doce_soprano_bar_yrs_302_b_iii.webp', link: linkPrefixo + 'flauta.html', categoria: 'flauta' },
        { nome: 'Flauta Transversal Tokai TFL-200PG', foto: prefixoPasta + 'img/flauta_transversal_tokai_tfl_200pg.webp', link: linkPrefixo + 'flauta.html', categoria: 'flauta' },
        { nome: 'Sax Alto Tokai TSA-200L', foto: prefixoPasta + 'img/sax_alto_tokai_tsa_200l.webp', link: linkPrefixo + 'saxofone.html', categoria: 'saxofone' },
        { nome: 'Sax Alto Yamaha YAS-280', foto: prefixoPasta + 'img/sax_alto_yamaha_yas_280.webp', link: linkPrefixo + 'saxofone.html', categoria: 'saxofone' },
        { nome: 'Sax Alto Eagle SA-501 Laqueado', foto: prefixoPasta + 'img/sax_alto_eagle_sa_501_laqueado.webp', link: linkPrefixo + 'saxofone.html', categoria: 'saxofone' },
        { nome: 'Trompete Schieffer Sib Laqueado SCHTP-001', foto: prefixoPasta + 'img/trompete_schieffer_sib_laqueado_schtp_001.webp', link: linkPrefixo + 'trompete.html', categoria: 'trompete' },
        { nome: 'Trompete Yamaha YTR-3335 CN', foto: prefixoPasta + 'img/trompete_yamaha_ytr_3335_cn.webp', link: linkPrefixo + 'trompete.html', categoria: 'trompete' },
        { nome: 'Trompete Tokai TR-400PG', foto: prefixoPasta + 'img/trompete_tokai_tr_400pg.webp', link: linkPrefixo + 'trompete.html', categoria: 'trompete' },
        { nome: 'Acordeon Benson 120 Baixos BAC120 7PBK', foto: prefixoPasta + 'img/acordeon_benson_120_b_bac120_7pbk.webp', link: linkPrefixo + 'acordeon.html', categoria: 'acordeon' },
        { nome: 'Acordeon Eagle EGA-0780 80 Baixos PRD VE', foto: prefixoPasta + 'img/acordeon_eagle_ega_0780_80_b_prd_ve.webp', link: linkPrefixo + 'acordeon.html', categoria: 'acordeon' },
        { nome: 'Acordeon Benson 8 Baixos BAC08 PWH', foto: prefixoPasta + 'img/acordeon_benson_8_b_bac08_pwh.webp', link: linkPrefixo + 'acordeon.html', categoria: 'acordeon' },
        { nome: 'Teclado Yamaha CK61', foto: prefixoPasta + 'img/teclado_yamaha_ck61.webp', link: linkPrefixo + 'teclado.html', categoria: 'teclado' },
        { nome: 'Teclado Revas KB 330', foto: prefixoPasta + 'img/teclado_revas_kb_330.webp', link: linkPrefixo + 'teclado.html', categoria: 'teclado' },
        { nome: 'Teclado Roland E-X50', foto: prefixoPasta + 'img/teclado_roland_e_x50.webp', link: linkPrefixo + 'teclado.html', categoria: 'teclado' },
        { nome: 'Baixo Seizi 4C Seido Precision Bass Black', foto: prefixoPasta + 'img/baixo_seizi_4c_seido_precision_bass_black.webp', link: linkPrefixo + 'baixo.html', categoria: 'baixo' },
        { nome: 'Baixo Tagima TW-66 4 Cordas ButterScotch - Escala Clara', foto: prefixoPasta + 'img/baixo_tagima_tw_66_4_cordas_butterscotch_escala_clara.webp', link: linkPrefixo + 'baixo.html', categoria: 'baixo' },
        { nome: 'Baixo Tagima TW-65 Mini 4 Cordas CA Candy Apple', foto: prefixoPasta + 'img/baixo_tagima_tw_65_mini_4_cordas_ca_candy_apple.webp', link: linkPrefixo + 'baixo.html', categoria: 'baixo' },
        { nome: 'Bateria Eletrônica Yamaha DTX 452K', foto: prefixoPasta + 'img/bateria_eletronica_yamaha_dtx_452k.webp', link: linkPrefixo + 'bateria.html', categoria: 'bateria' },
        { nome: 'Bateria RMV Infinity 20 com Prato e Banco', foto: prefixoPasta + 'img/bateria_rmv_infinity_20_com_prato_e_banco.webp', link: linkPrefixo + 'bateria.html', categoria: 'bateria' },
        { nome: 'Bateria Mapex Venus BD-20 VC Blue Metalic 5 peças', foto: prefixoPasta + 'img/bateria_mapex_venus_bd_20_vc_blue_metalic_5_pecas.webp', link: linkPrefixo + 'bateria.html', categoria: 'bateria' },
        { nome: 'Violino Michael VNM40 4/4', foto: prefixoPasta + 'img/violino_michael_vnm40_4_4.webp', link: linkPrefixo + 'violino.html', categoria: 'violino' },
        { nome: 'Violino Hofma Estudante HVE 221 1/2', foto: prefixoPasta + 'img/violino_hofma_estudante_hve_221_1_2.webp', link: linkPrefixo + 'violino.html', categoria: 'violino' },
        { nome: 'Violino Nhureson Madeira Exposta Fosco 4', foto: prefixoPasta + 'img/violino_nhureson_madeira_exposta_fosco_4.webp', link: linkPrefixo + 'violino.html', categoria: 'violino' },
        { nome: 'Ukulele KA-15S', foto: prefixoPasta + 'img/KA_15S_20_R.webp', link: linkPrefixo + 'ukulele.html', categoria: 'ukulele' },
        { nome: 'Ukulele Fender Venice California Series', foto: prefixoPasta + 'img/ukulele_fender_venice_california_series.webp', link: linkPrefixo + 'ukulele.html', categoria: 'ukulele' },
        { nome: 'Ukulele Sun Concert', foto: prefixoPasta + 'img/ukulele_luthier.jpg', link: linkPrefixo + 'ukulele.html', categoria: 'ukulele' },
        { nome: 'Kit Palhetas Tortex', foto: prefixoPasta + 'img/kit_8_palheta.webp', link: linkPrefixo + 'acessorios.html', categoria: 'acessorios' },
        { nome: 'Correia Original', foto: prefixoPasta + 'img/correia_fender.webp', link: linkPrefixo + 'acessorios.html', categoria: 'acessorios' },
        { nome: 'Capa Acolchoada', foto: prefixoPasta + 'img/capa_guitarra_acolchoada.webp', link: linkPrefixo + 'acessorios.html', categoria: 'acessorios' }
    ]
};

// 4. PRODUTOS EM DESTAQUE
function initDestaques() {
    const gradeProdutos = document.getElementById('grade-produtos-destaque');

    if (gradeProdutos) {
        const buscarProduto = (nome) => dadosBusca.produtos.find(p => p.nome === nome);

        const destaques = [
            { produto: buscarProduto('Piano Digital Portátil FP-30X'), preco: 'R$ 5.499,00' },
            { produto: buscarProduto('Violão Hertom J45 Stage - Sunburst RW'), preco: 'R$ 1.249,00' },
            { produto: buscarProduto('Guitarra Michael GM217N SK'), preco: 'R$ 899,00' },
            { produto: buscarProduto('Sax Alto Eagle SA-501 Laqueado'), preco: 'R$ 2.199,00' },
            { produto: buscarProduto('Bateria Mapex Venus BD-20 VC Blue Metalic 5 peças'), preco: 'R$ 3.799,00' },
            { produto: buscarProduto('Violino Michael VNM40 4/4'), preco: 'R$ 699,00' }
        ].filter(item => item.produto);

        destaques.forEach(({ produto, preco }) => {
            const card = document.createElement('a');
            card.href = produto.link;
            card.className = 'card-produto';

            // Escapa nome/foto/preço antes de montar o HTML (evita quebrar os
            // atributos caso um texto contenha aspas, & ou <>)
            const nomeSeguro = escaparHtml(produto.nome);
            const fotoSegura = escaparHtml(produto.foto);

            card.innerHTML = `
                <div class="card-produto-img">
                    <img src="${fotoSegura}" alt="${nomeSeguro}" onerror="this.src='https://placehold.co/100x100'">
                </div>
                <p class="card-produto-nome">${nomeSeguro}</p>
                <p class="card-produto-preco">${escaparHtml(preco)}</p>
                <span class="botao-produto btn-orcamento" data-nome="${nomeSeguro}" data-foto="${fotoSegura}">Consultar Preço</span>
            `;

            gradeProdutos.appendChild(card);
        });
    }
}

// 5. BUSCA INTELIGENTE
function initBusca() {
    const campoBusca = document.getElementById('campo-busca');
    const caixaSugestoes = document.getElementById('caixa-sugestoes');
    const botaoBusca = document.querySelector('.botao-busca');

    if (campoBusca && caixaSugestoes) {
        const limparTexto = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

        // Refaz a busca com o termo informado e monta a caixa de sugestões
        const executarBusca = (termoOriginal) => {
            const termoLimpo = limparTexto(termoOriginal);

            if (termoLimpo.length === 0) {
                caixaSugestoes.style.display = 'none';
                return;
            }

            const sugestoesFiltradas = dadosBusca.sugestoes.filter(s =>
                limparTexto(s.texto).includes(termoLimpo)
            );

            const produtosFiltrados = dadosBusca.produtos.filter(p =>
                limparTexto(p.nome).includes(termoLimpo) || limparTexto(p.categoria).includes(termoLimpo)
            );

            caixaSugestoes.innerHTML = '';

            if (sugestoesFiltradas.length === 0 && produtosFiltrados.length === 0) {
                caixaSugestoes.innerHTML = `<div class="secao-busca-vazia">Nenhum resultado encontrado</div>`;
                caixaSugestoes.style.display = 'block';
                return;
            }

            if (sugestoesFiltradas.length > 0) {
                const divTituloSugestao = document.createElement('div');
                divTituloSugestao.className = 'titulo-grupo-busca';
                divTituloSugestao.textContent = 'SUGESTÃO';
                caixaSugestoes.appendChild(divTituloSugestao);

                sugestoesFiltradas.forEach(sugestao => {
                    const item = document.createElement('a');
                    item.href = sugestao.link;
                    item.className = 'item-sugestao-texto';
                    item.style.display = 'block';
                    item.textContent = formatarIniciais(sugestao.texto);
                    caixaSugestoes.appendChild(item);
                });
            }

            if (produtosFiltrados.length > 0) {
                const divTituloProduto = document.createElement('div');
                divTituloProduto.className = 'titulo-grupo-busca';
                divTituloProduto.textContent = 'PRODUTOS';
                caixaSugestoes.appendChild(divTituloProduto);

                produtosFiltrados.forEach(prod => {
                    const linkProd = document.createElement('a');
                    linkProd.href = prod.link;
                    linkProd.className = 'item-produto-busca';
                    linkProd.innerHTML = `<img src="${escaparHtml(prod.foto)}" alt="${escaparHtml(prod.nome)}" class="mini-foto-busca" onerror="this.src='https://placehold.co/100x100'"> <span class="nome-produto-busca">${escaparHtml(prod.nome)}</span>`;
                    caixaSugestoes.appendChild(linkProd);
                });
            }

            caixaSugestoes.style.display = 'block';
        };

        // Implementação do Debounce (300ms) para melhorar a performance
        campoBusca.addEventListener('input', debounce((e) => executarBusca(e.target.value), 300)); // Aguarda 300ms sem digitar para filtrar

        // Botão da lupa: abre o primeiro resultado da busca
        const abrirPrimeiroResultado = () => {
            if (!campoBusca.value.trim()) {
                campoBusca.focus();
                return;
            }

            if (caixaSugestoes.style.display !== 'block') {
                executarBusca(campoBusca.value);
            }

            const primeiroLink = caixaSugestoes.querySelector('a');
            if (primeiroLink) window.location.href = primeiroLink.href;
        };

        if (botaoBusca) {
            botaoBusca.addEventListener('click', abrirPrimeiroResultado);
        }

        // Tecla Enter no campo também abre o primeiro resultado
        campoBusca.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                abrirPrimeiroResultado();
            }

            // Escape fecha a caixa de sugestões (UX consistente com o restante)
            if (e.key === 'Escape') {
                caixaSugestoes.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.busca-container')) {
                caixaSugestoes.style.display = 'none';
            }
        });
    }
}

// 6. GRADE INTERNA, FAVORITOS, FILTROS E MODAL
function initGradeProdutos() {
    const gradeInterna = document.querySelector('.grade-produtos-interno');

    if (gradeInterna) {
        const cards = Array.from(gradeInterna.querySelectorAll('.card-produto-interno'));
        // ID estável baseado no arquivo da imagem (único por produto), em vez do
        // texto do nome — que, se editado no HTML, invalidaria os favoritos salvos
        const idDoCard = (card) => {
            const img = card.querySelector('.produto-img-wrapper img');
            const arquivo = img ? (img.getAttribute('src') || '').split('/').pop().replace(/\.[^.]+$/, '') : '';
            return arquivo || card.querySelector('.nome-produto').textContent.trim();
        };

        // Nome de exibição/ordenação — o id acima serve só para identificar favoritos
        const nomeDoCard = (card) => card.querySelector('.nome-produto').textContent.trim();

        const CHAVE_FAVORITOS = 'flowmusic_favoritos';
        const lerFavoritos = () => {
            try {
                return JSON.parse(localStorage.getItem(CHAVE_FAVORITOS)) || [];
            } catch (erro) {
                return [];
            }
        };
        const salvarFavoritos = (lista) => {
            try {
                localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(lista));
            } catch (erro) {
                console.warn('Não foi possível salvar os favoritos:', erro);
            }
        };

        // Migra favoritos antigos (salvos pelo nome do produto) para o novo ID
        // estável, para não perder nada do que o usuário já havia marcado
        const migrarFavoritosAntigos = () => {
            const favoritos = lerFavoritos();
            if (favoritos.length === 0) return;

            const mapaAntigo = new Map();
            cards.forEach(card => {
                const nome = nomeDoCard(card);
                const idAtual = idDoCard(card);
                if (nome !== idAtual) mapaAntigo.set(nome, idAtual);
            });
            if (mapaAntigo.size === 0) return;

            const atualizados = [...new Set(favoritos.map(f => mapaAntigo.get(f) || f))];
            if (JSON.stringify(atualizados) !== JSON.stringify(favoritos)) {
                salvarFavoritos(atualizados);
            }
        };
        migrarFavoritosAntigos();

        const toolbar = document.createElement('div');
        toolbar.className = 'produtos-toolbar';
        toolbar.innerHTML = `
            <label for="ordenar-produtos">Ordenar por:</label>
            <select id="ordenar-produtos">
                <option value="padrao">Padrão</option>
                <option value="nome-az">Nome (A-Z)</option>
                <option value="nome-za">Nome (Z-A)</option>
                <option value="marca-az">Marca (A-Z)</option>
            </select>
            <label class="filtro-favoritos-label">
                <input type="checkbox" id="filtro-favoritos"> Mostrar só favoritos
            </label>
        `;
        gradeInterna.parentElement.insertBefore(toolbar, gradeInterna);

        const selectOrdenar = document.getElementById('ordenar-produtos');
        const checkboxFavoritos = document.getElementById('filtro-favoritos');

        cards.forEach(card => {
            // Torna o card focável por teclado (A11y). Sem role="button": o card
            // contém links e botões internos, e um papel de "contêiner interativo"
            // tornaria a navegação por leitor de tela confusa.
            card.setAttribute('tabindex', '0');

            const wrapper = card.querySelector('.produto-img-wrapper');
            const btnFav = document.createElement('button');
            btnFav.type = 'button';
            btnFav.className = 'favorito-btn';
            btnFav.setAttribute('aria-label', 'Favoritar produto');

            const id = idDoCard(card);
            const jaFavoritado = lerFavoritos().includes(id);
            btnFav.innerHTML = jaFavoritado ? '<i class="bi bi-heart-fill"></i>' : '<i class="bi bi-heart"></i>';
            if (jaFavoritado) btnFav.classList.add('ativo');

            const btnOrcamento = card.querySelector('.btn-orcamento');
            const imgEl = wrapper.querySelector('img');
            if (btnOrcamento && imgEl) {
                btnOrcamento.dataset.nome = nomeDoCard(card);
                btnOrcamento.dataset.foto = imgEl.src;
            }

            btnFav.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                let favoritos = lerFavoritos();
                if (favoritos.includes(id)) {
                    favoritos = favoritos.filter(f => f !== id);
                    btnFav.classList.remove('ativo');
                    btnFav.innerHTML = '<i class="bi bi-heart"></i>';
                    mostrarNotificacao('Removido dos favoritos.'); // UX Feedback
                } else {
                    favoritos.push(id);
                    btnFav.classList.add('ativo');
                    btnFav.innerHTML = '<i class="bi bi-heart-fill"></i>';
                    mostrarNotificacao('Adicionado aos favoritos!'); // UX Feedback
                }
                salvarFavoritos(favoritos);
                if (checkboxFavoritos.checked) aplicarFiltrosEOrdenacao();
            });

            wrapper.appendChild(btnFav);
        });

        function mostrarMensagemVazia() {
            removerMensagemVazia();
            const msg = document.createElement('p');
            msg.className = 'mensagem-grade-vazia';
            msg.textContent = 'Nenhum produto encontrado.';
            gradeInterna.parentElement.appendChild(msg);
        }

        function removerMensagemVazia() {
            const existente = gradeInterna.parentElement.querySelector('.mensagem-grade-vazia');
            if (existente) existente.remove();
        }

        function aplicarFiltrosEOrdenacao() {
            let listaCards = cards.slice();

            if (checkboxFavoritos.checked) {
                const favoritos = lerFavoritos();
                listaCards = listaCards.filter(c => favoritos.includes(idDoCard(c)));
            }

            const criterio = selectOrdenar.value;
            if (criterio === 'nome-az') {
                listaCards.sort((a, b) => nomeDoCard(a).localeCompare(nomeDoCard(b)));
            } else if (criterio === 'nome-za') {
                listaCards.sort((a, b) => nomeDoCard(b).localeCompare(nomeDoCard(a)));
            } else if (criterio === 'marca-az') {
                listaCards.sort((a, b) =>
                    a.querySelector('.marca-produto').textContent.localeCompare(b.querySelector('.marca-produto').textContent)
                );
            }

            cards.forEach(c => { c.style.display = 'none'; });

            const fragmento = document.createDocumentFragment();
            listaCards.forEach(c => {
                c.style.display = '';
                fragmento.appendChild(c);
            });
            gradeInterna.appendChild(fragmento);

            listaCards.length === 0 ? mostrarMensagemVazia() : removerMensagemVazia();
        }

        selectOrdenar.addEventListener('change', aplicarFiltrosEOrdenacao);
        checkboxFavoritos.addEventListener('change', aplicarFiltrosEOrdenacao);

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-produto-overlay';
        modalOverlay.innerHTML = `
            <div class="modal-produto" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
                <button type="button" class="modal-produto-fechar" aria-label="Fechar modal">&times;</button>
                <div class="modal-produto-img-wrapper">
                    <img class="modal-produto-img" src="" alt="">
                </div>
                <div class="modal-produto-info">
                    <p class="modal-marca"></p>
                    <p class="modal-nome" id="modal-titulo"></p>
                    <p class="modal-detalhes"></p>
                    <a class="modal-btn-orcamento btn-orcamento" href="#" target="_blank" rel="noopener noreferrer">Consultar Preço</a>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        let cardFocadoAnteriormente = null; // A11y: Retornar foco após fechar modal

        // Enquanto o modal está aberto, o fundo fica "inert" (não recebe foco
        // nem cliques). Browsers antigos ignoram a propriedade sem efeitos colaterais.
        const elementosFundo = Array.from(document.querySelectorAll('header, main, footer'));
        const definirFundoInert = (inert) => {
            elementosFundo.forEach(el => { el.inert = inert; });
        };

        const fecharModal = () => {
            modalOverlay.classList.remove('ativo');
            definirFundoInert(false);
            if (cardFocadoAnteriormente) cardFocadoAnteriormente.focus();
        };

        modalOverlay.querySelector('.modal-produto-fechar').addEventListener('click', fecharModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) fecharModal();
        });
        document.addEventListener('keydown', (e) => {
            if (!modalOverlay.classList.contains('ativo')) return;

            if (e.key === 'Escape') {
                fecharModal();
                return;
            }

            // Mantém o foco preso dentro do modal enquanto ele estiver aberto (A11y)
            if (e.key === 'Tab') {
                const focaveis = Array.from(modalOverlay.querySelectorAll('button, a[href]'));
                if (focaveis.length === 0) return;

                const primeiro = focaveis[0];
                const ultimo = focaveis[focaveis.length - 1];
                const atual = document.activeElement;

                if (!modalOverlay.contains(atual)) {
                    e.preventDefault();
                    primeiro.focus();
                } else if (e.shiftKey && atual === primeiro) {
                    e.preventDefault();
                    ultimo.focus();
                } else if (!e.shiftKey && atual === ultimo) {
                    e.preventDefault();
                    primeiro.focus();
                }
            }
        });

        // Função de abrir o modal extraída para suportar clique e tecla Enter
        const acionarCard = (card, e) => {
            if (e.target.closest('.btn-orcamento') || e.target.closest('.favorito-btn')) return;

            cardFocadoAnteriormente = card; // Salva o card de origem (A11y)
            const img = card.querySelector('.produto-img-wrapper img');
            const modalImg = modalOverlay.querySelector('.modal-produto-img');
            const modalOrcamento = modalOverlay.querySelector('.modal-btn-orcamento');

            modalImg.src = img.src;
            modalImg.alt = img.alt;
            modalOverlay.querySelector('.modal-marca').textContent = card.querySelector('.marca-produto').textContent;
            const nomeProd = card.querySelector('.nome-produto').textContent;
            modalOverlay.querySelector('.modal-nome').textContent = nomeProd;
            modalOverlay.querySelector('.modal-detalhes').textContent = card.querySelector('.detalhes-tecnicos').textContent;
            
            const btnCard = card.querySelector('.btn-orcamento');
            const urlDestino = btnCard.getAttribute('href') || btnCard.href || card.closest('a')?.href || '#';

            modalOrcamento.href = urlDestino;
            modalOrcamento.dataset.nome = nomeProd;
            modalOrcamento.dataset.foto = img.src;

            definirFundoInert(true);
            modalOverlay.classList.add('ativo');
            modalOverlay.querySelector('.modal-produto-fechar').focus(); // Foca no "X" (A11y)
        };

        cards.forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => acionarCard(card, e));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    acionarCard(card, e);
                }
            });
        });

        let contadorStagger = 0;
        let timeoutStagger = null;

        const observadorCards = new IntersectionObserver((entradas) => {
            entradas.forEach((entrada) => {
                if (entrada.isIntersecting) {
                    clearTimeout(timeoutStagger);
                    const atrasoAtual = contadorStagger * 80;
                    
                    setTimeout(() => {
                        entrada.target.classList.add('revelado');
                    }, atrasoAtual);

                    contadorStagger++;
                    observadorCards.unobserve(entrada.target);

                    timeoutStagger = setTimeout(() => {
                        contadorStagger = 0;
                    }, 400);
                }
            });
        }, { threshold: 0.15 });

        cards.forEach(card => {
            card.classList.add('pre-revelado');
            observadorCards.observe(card);
        });
    }
}

function formatarIniciais(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}