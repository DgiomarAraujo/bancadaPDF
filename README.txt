BANCADA PDF — como publicar
===========================

1) HOSPEDAGEM
   Envie TODO o conteúdo desta pasta para qualquer hospedagem de site estático
   (Hostinger, cPanel, Netlify, Cloudflare Pages, GitHub Pages...). Pode ser em um
   subdomínio, por exemplo pdf.seudominio.com.br. É preciso HTTPS para o modo
   "instalar como app" e o uso offline.

2) ANTES DE PUBLICAR, TROQUE OS MARCADORES
   - SEU-DOMINIO.com.br  -> seu endereço real (index.html, sitemap.xml, robots.txt, privacidade etc.)
   - [SEU NOME OU EMPRESA] -> nome do responsável (privacidade.html e termos.html)
   - contato@SEU-DOMINIO.com.br -> seu e-mail
   (Dica: abra a pasta num editor e use "localizar e substituir em todos os arquivos".)
   Revise a Política de Privacidade e os Termos; eles são um modelo, não aconselhamento jurídico.

3) ANÚNCIOS (Google AdSense)
   a. Publique o site e peça a análise em adsense.google.com (adicione o site).
   b. Enquanto não for aprovado, deixe assets/config.js com enabled:false.
      Com preview:true você vê caixas tracejadas mostrando onde os anúncios vão ficar.
   c. Depois de aprovado: crie 2 blocos de anúncio (um "side" e um "inline"),
      preencha client e slots em assets/config.js, coloque enabled:true e preview:false.
   d. Edite ads.txt com seu ID de editor.
   e. Onde aparecem: coluna lateral à direita em telas largas (>=1280 px) e um bloco
      dentro da página nas demais. Nunca perto dos botões Processar/Baixar.
   f. O aviso de cookies (Aceitar / Só o essencial) já está pronto. Se recusar:
      "npa" mostra anúncios não personalizados; "none" não mostra nada.
      Para conformidade completa com a LGPD, considere também ativar as
      "Mensagens de privacidade e consentimento" do próprio AdSense.

4) TESTAR NO SEU COMPUTADOR
   Abra um terminal nesta pasta e rode:  python3 -m http.server 8000
   Depois acesse http://localhost:8000

5) ATUALIZAR
   Ao trocar arquivos, mude o nome do cache em sw.js (const V=...) para os visitantes receberem a versão nova.
