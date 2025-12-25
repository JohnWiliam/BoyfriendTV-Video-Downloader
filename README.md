# 📥 BoyfriendTV Downloader [Ultimate]

![Version](https://img.shields.io/badge/Version-2.0.1-blue)
![Language](https://img.shields.io/badge/Language-JavaScript-F7DF1E?logo=javascript&logoColor=F7DF1E)
![Author](https://img.shields.io/badge/Author-John%20Wiliam%20%26%20IA-orange)
[![Install](https://img.shields.io/badge/Install-Click_Here-green)](https://github.com/JohnWiliam/BoyfriendTV-Video-Downloader/raw/refs/heads/main/BoyfriendTV%20Video%20Downloader.user.js)

Um Userscript robusto e moderno para **Violentmonkey**, projetado para facilitar o download de vídeos segmentados (HLS) no BoyfriendTV. Com uma interface polida e um motor de download otimizado, ele oferece uma experiência de usuário superior, permitindo baixar vídeos em diversas resoluções com alta velocidade e estabilidade.

---

## ✨ Funcionalidades Principais

O script foi desenvolvido com foco em performance e usabilidade (UX/UI):

* **🎨 Interface Moderna (UI):** Painel flutuante com *Grid Layout*, fontes limpas (Inter) e design responsivo "Dark Mode".
* **🧩 Suporte HLS Nativo:** Capaz de identificar, baixar e unir automaticamente segmentos `.ts` em um arquivo final pronto para reprodução.
* **⚡ Download Multi-thread:** Sistema inteligente que gerencia filas de download com até **3 conexões simultâneas** (configurável) para maximizar a velocidade.
* **🛡️ Resiliência a Falhas:** Lógica de *retry* automática (até 5 tentativas) para lidar com instabilidades de rede ou timeouts em segmentos específicos.
* **📊 Monitoramento em Tempo Real:** Exibe o progresso percentual, velocidade de download (MB/s) e status de cada vídeo individualmente.
* **🏷️ Títulos Limpos:** Algoritmo de extração inteligente que remove metadados desnecessários (como contagem de visualizações) do nome do arquivo final.
* **💾 Salvamento via Blob:** Utiliza a API de Blob do navegador para gerar e salvar o arquivo final sem depender excessivamente de servidores externos.

---

## 🚀 Instalação

Para utilizar este script, você precisa de um gerenciador de userscripts instalado em seu navegador.

1.  Instale a extensão **[Violentmonkey](https://violentmonkey.github.io/)** (Recomendado).
2.  Clique no botão de instalação abaixo ou adicione manualmente o arquivo `.user.js` ao seu gerenciador.
3.  Confirme a instalação quando a janela do Violentmonkey aparecer.

> **Nota:** Este script requer permissões especiais (`GM_xmlhttpRequest`, `GM_download`, etc.) para realizar requisições entre domínios e gerenciar arquivos.

---

## 🛠️ Como Usar

1.  Acesse qualquer página de vídeo no **BoyfriendTV**.
2.  Aguarde o carregamento da página. Você verá um **botão flutuante (FAB)** com um ícone de download no canto inferior direito da tela.
3.  **Clique no botão** para abrir o painel do gerenciador.
4.  O script analisará automaticamente as resoluções disponíveis.
5.  Clique no botão **"Baixar"** ao lado da qualidade desejada.
6.  Acompanhe o progresso na barra visual. Quando concluído, o navegador solicitará o local para salvar o arquivo `.ts`.

---

## ⚙️ Detalhes Técnicos

Para desenvolvedores ou curiosos, o script opera nas seguintes camadas:

* **MediaExtractor:** Varre o DOM e variáveis globais (`var sources`) para encontrar streams HLS e arquivos MP4, limpando o título do vídeo removendo elementos como `.views-count`.
* **Downloader Class:**
    * Analisa playlists `.m3u8`.
    * Gerencia um *pool* de Workers para baixar segmentos simultaneamente.
    * Calcula a velocidade média de transferência.
    * Une os `ArrayBuffers` dos segmentos em um único `Blob` (`video/mp2t`).
* **Persistência:** Utiliza `GM_getValue`/`GM_setValue` para tentar recuperar estados (preparado para implementações futuras de "resume").

---

## ⚠️ Aviso Legal

Este script é fornecido apenas para fins educacionais e de uso pessoal. O autor não se responsabiliza pelo uso indevido da ferramenta ou por violações dos termos de serviço de terceiros.

---

<div align="center">
    <i>Desenvolvido com ❤️ e JavaScript por John Wiliam</i>
</div>
