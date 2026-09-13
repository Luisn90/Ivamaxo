/* IVAMAXO — Invitación a instalar la app
 *
 * Tres caminos, porque no todos los navegadores instalan igual:
 *   1. Chrome/Edge Android con Play Services → instalación nativa de un toque.
 *   2. iPhone → Apple no permite instalar por código: se explican los pasos.
 *   3. Resto (ZTE y otros Android sin Play Services completos, Firefox,
 *      navegadores embebidos) → instrucciones para "Añadir a pantalla de
 *      inicio", que crea un acceso directo equivalente.
 *
 * No se muestra si ya está instalada ni si el usuario la cerró hace poco.
 */
(function () {
  'use strict';

  var CLAVE   = 'ivamaxo_install_cerrado';
  var ESPERA  = 14 * 24 * 60 * 60 * 1000;   // 14 días de silencio tras cerrar
  var RETRASO = 3500;                        // deja mirar la tienda primero

  // ── ¿ya está instalada? ──
  var instalada =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.indexOf('android-app://') === 0;
  if (instalada) return;

  var cerrado = parseInt(localStorage.getItem(CLAVE) || '0', 10);
  if (cerrado && Date.now() - cerrado < ESPERA) return;

  var ua       = navigator.userAgent;
  var esIOS    = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  var esSafari = esIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  // Navegador dentro de otra app: no puede instalar nada
  var embebido = /FBAN|FBAV|Instagram|Line|WhatsApp|wv\)/.test(ua);

  var evento = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    evento = e;
    var btn = document.getElementById('pwaAccion');
    if (btn) { btn.textContent = 'Instalar ahora'; btn.dataset.modo = 'nativo'; }
  });

  window.addEventListener('appinstalled', function () {
    localStorage.setItem(CLAVE, String(Date.now() + ESPERA * 10));
    cerrar();
  });

  var css = ''
    + '#pwaSheet{position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;'
    + 'background:rgba(0,0,0,.55);opacity:0;transition:opacity .28s ease;font-family:Montserrat,system-ui,sans-serif}'
    + '#pwaSheet.on{opacity:1}'
    + '#pwaCard{width:100%;max-width:420px;background:#fff;border-radius:20px 20px 0 0;padding:26px 24px 30px;'
    + 'transform:translateY(100%);transition:transform .34s cubic-bezier(.22,1,.36,1);position:relative}'
    + '#pwaSheet.on #pwaCard{transform:translateY(0)}'
    + '@media(min-width:540px){#pwaSheet{align-items:center}#pwaCard{border-radius:20px;transform:translateY(24px) scale(.97)}'
    + '#pwaSheet.on #pwaCard{transform:none}}'
    + '#pwaCard .x{position:absolute;top:14px;right:14px;width:32px;height:32px;border:none;background:#F5F5F5;'
    + 'border-radius:50%;cursor:pointer;color:#888;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center}'
    + '#pwaCard .x:hover{background:#E8E8E8;color:#0A0A0A}'
    + '#pwaCard .ico{width:60px;height:60px;border-radius:14px;display:block;margin-bottom:16px}'
    + '#pwaCard h3{font-size:20px;font-weight:700;color:#0A0A0A;margin:0 0 8px;letter-spacing:-.02em;line-height:1.2}'
    + '#pwaCard p{font-size:13px;font-weight:500;color:#888;line-height:1.6;margin:0 0 20px}'
    + '#pwaCard ol{margin:0 0 20px;padding:0;list-style:none;counter-reset:p}'
    + '#pwaCard li{counter-increment:p;position:relative;padding:0 0 0 32px;margin-bottom:11px;'
    + 'font-size:13px;font-weight:600;color:#0A0A0A;line-height:1.5}'
    + '#pwaCard li::before{content:counter(p);position:absolute;left:0;top:-1px;width:22px;height:22px;border-radius:50%;'
    + 'background:#F9C200;color:#0A0A0A;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center}'
    + '#pwaCard li b{font-weight:800}'
    + '#pwaAccion{width:100%;padding:14px;background:#F9C200;border:none;border-radius:50px;font-family:inherit;'
    + 'font-size:14.5px;font-weight:700;color:#0A0A0A;cursor:pointer;transition:background .2s}'
    + '#pwaAccion:hover{background:#D9A800}'
    + '#pwaLuego{width:100%;margin-top:10px;padding:9px;background:none;border:none;font-family:inherit;'
    + 'font-size:12.5px;font-weight:600;color:#888;cursor:pointer}'
    + '#pwaLuego:hover{color:#0A0A0A}';

  function pasosIOS() {
    return '<ol>'
      + '<li>Toca el botón <b>Compartir</b> en la barra de abajo</li>'
      + '<li>Baja y elige <b>Añadir a pantalla de inicio</b></li>'
      + '<li>Confirma con <b>Añadir</b></li>'
      + '</ol>';
  }

  function pasosAndroid() {
    return '<ol>'
      + '<li>Abre el menú <b>⋮</b> arriba a la derecha</li>'
      + '<li>Toca <b>Añadir a pantalla de inicio</b></li>'
      + '<li>Confirma con <b>Añadir</b> o <b>Instalar</b></li>'
      + '</ol>';
  }

  function construir() {
    var manual = !evento;
    var cuerpo, pasos = '', accion = 'Instalar ahora', modo = 'nativo';

    if (embebido) {
      cuerpo = 'Estás viendo la tienda dentro de otra aplicación. Ábrela en Chrome o Safari para poder instalarla.';
      pasos  = '<ol><li>Abre el menú <b>⋮</b> de esta ventana</li>'
             + '<li>Elige <b>Abrir en el navegador</b></li></ol>';
      accion = 'Entendido';
      modo   = 'cerrar';
    } else if (esIOS) {
      cuerpo = esSafari
        ? 'Añádela a tu pantalla de inicio y ábrela como una app, sin barra del navegador.'
        : 'En iPhone solo se puede añadir desde Safari. Abre esta página en Safari y sigue estos pasos.';
      pasos  = pasosIOS();
      accion = 'Entendido';
      modo   = 'cerrar';
    } else if (manual) {
      cuerpo = 'Tenla a un toque en tu pantalla de inicio, con acceso al catálogo completo.';
      pasos  = pasosAndroid();
      accion = 'Entendido';
      modo   = 'cerrar';
    } else {
      cuerpo = 'Instálala en tu teléfono y consulta el catálogo cuando quieras, incluso con mala señal.';
    }

    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    var d = document.createElement('div');
    d.id = 'pwaSheet';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-label', 'Instalar la app de IVAMAXO');
    d.innerHTML =
        '<div id="pwaCard">'
      +   '<button class="x" id="pwaX" aria-label="Cerrar">&#10005;</button>'
      +   '<img class="ico" src="icons/icon-192.png" alt="">'
      +   '<h3>Lleva IVAMAXO contigo</h3>'
      +   '<p>' + cuerpo + '</p>'
      +   pasos
      +   '<button id="pwaAccion" data-modo="' + modo + '">' + accion + '</button>'
      +   '<button id="pwaLuego">Ahora no</button>'
      + '</div>';
    document.body.appendChild(d);

    requestAnimationFrame(function () { d.classList.add('on'); });

    document.getElementById('pwaX').onclick     = descartar;
    document.getElementById('pwaLuego').onclick = descartar;
    d.onclick = function (e) { if (e.target === d) descartar(); };

    document.getElementById('pwaAccion').onclick = function () {
      if (this.dataset.modo === 'nativo' && evento) {
        evento.prompt();
        evento.userChoice.then(function (r) {
          if (r.outcome !== 'accepted') descartar(); else cerrar();
          evento = null;
        });
      } else {
        descartar();
      }
    };
  }

  function cerrar() {
    var d = document.getElementById('pwaSheet');
    if (!d) return;
    d.classList.remove('on');
    setTimeout(function () { d.remove(); }, 320);
  }

  function descartar() {
    localStorage.setItem(CLAVE, String(Date.now()));
    cerrar();
  }

  // Permite abrirlo a mano desde un enlace del pie de página
  window.mostrarInstalarApp = function () {
    localStorage.removeItem(CLAVE);
    if (!document.getElementById('pwaSheet')) construir();
  };

  setTimeout(function () {
    if (!document.getElementById('pwaSheet')) construir();
  }, RETRASO);
})();
