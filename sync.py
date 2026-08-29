import os

# Configuración de rutas
script_dir = os.path.dirname(os.path.abspath(__file__))
scratch_dir = os.path.dirname(script_dir)

css_path = os.path.join(script_dir, 'styles.css')
jsx_path = os.path.join(script_dir, 'app.jsx')
template_path = os.path.join(script_dir, 'template.html')

# Archivos de salida
local_index_path = os.path.join(script_dir, 'index.html')
global_preview_path = os.path.join(scratch_dir, 'previsualizacion-comedorcsb.html')

print("Iniciando compilación de Comedor SB...")

try:
    # Cargar CSS
    if os.path.exists(css_path):
        with open(css_path, 'r', encoding='utf-8') as f:
            css_content = f.read()
    else:
        css_content = "/* Estilos personalizados */"
    print(f"Loaded CSS: {len(css_content)} bytes")

    # Cargar JSX
    if os.path.exists(jsx_path):
        with open(jsx_path, 'r', encoding='utf-8') as f:
            jsx_content = f.read()
    else:
        jsx_content = "// Lógica de React"
    print(f"Loaded JSX: {len(jsx_content)} bytes")

    # HTML de plantilla con soporte PWA y Apple web apps
    html_template = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comedor SB - Gestión de Comensales</title>
  
  <!-- SEO y Accesibilidad -->
  <meta name="description" content="Aplicación inteligente de control y gestión de comensales para el comedor escolar del Colegio San Buenaventura.">
  
  <!-- PWA Soporte -->
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#4f46e5">
  
  <!-- Apple Web App Metas -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Comedor SB">
  <link rel="apple-touch-icon" href="https://i.ibb.co/YvMv3Qx/Logo-sin-fondo.png">

  <!-- Tailwind CSS v3 Play CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {{
      darkMode: 'class',
      theme: {{
        extend: {{
          colors: {{
            brand: {{
              50: '#eef2ff',
              100: '#e0e7ff',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
            }},
            infantil: {{
              bg: '#fdf2f8',
              border: '#fbcfe8',
              text: '#db2777',
            }},
            primaria: {{
              bg: '#f0fdf4',
              border: '#bbf7d0',
              text: '#16a34a',
            }}
          }}
        }}
      }}
    }}
  </script>

  <!-- Google Fonts: Outfit -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">

  <!-- React & ReactDOM (versiones estables de producción) -->
  <script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js" crossorigin></script>

  <!-- Babel Standalone para transpilar JSX en tiempo de ejecución -->
  <script src="https://unpkg.com/@babel/standalone@7.23.10/babel.min.js"></script>

  <!-- Canvas Confetti para animaciones de éxito -->
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>

  <style>
{css_content}
  </style>
</head>
<body class="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-105 min-h-screen transition-colors duration-300">
  
  <!-- Banner de Captura de Errores -->
  <div id="error-banner" style="display:none; background:#fee2e2; border:2px solid #ef4444; color:#991b1b; padding:20px; margin:20px; font-family:monospace; border-radius:10px; white-space:pre-wrap; z-index:9999; position:relative;">
    <h2 style="margin:0 0 10px 0;">⚠️ Error de Carga / Ejecución (Babel o React)</h2>
    <div id="error-message"></div>
  </div>
  <script>
    window.addEventListener('error', function(e) {{
      document.getElementById('error-banner').style.display = 'block';
      document.getElementById('error-message').innerText += '\\n' + e.message + (e.filename ? ' en ' + e.filename : '') + (e.lineno ? ':' + e.lineno : '');
    }});
    window.addEventListener('unhandledrejection', function(e) {{
      document.getElementById('error-banner').style.display = 'block';
      document.getElementById('error-message').innerText += '\\nPromesa rechazada: ' + e.reason;
    }});
    
    // Interceptar console.error para mostrar fallos de compilación de Babel
    const origConsoleError = console.error;
    console.error = function() {{
      origConsoleError.apply(console, arguments);
      const msg = Array.from(arguments).map(arg => {{
        if (arg instanceof Error) return arg.message + '\\n' + arg.stack;
        if (typeof arg === 'object') return JSON.stringify(arg);
        return String(arg);
      }}).join(' ');
      
      if (msg.includes('Babel') || msg.includes('React') || msg.includes('syntax') || msg.includes('failed') || msg.includes('Error') || msg.includes('Unexpected')) {{
        document.getElementById('error-banner').style.display = 'block';
        document.getElementById('error-message').innerText += '\\n' + msg;
      }}
    }};
  </script>

  <!-- Contenedor Raíz de React -->
  <div id="app-root"></div>

  <!-- Lucide Icons Core + React binding global (vía esm.sh para poder importarlo) -->
  <!-- Firebase modular se importa dinámicamente en el script de Babel -->

  <script type="text/babel" data-type="module">
{jsx_content}
  </script>

  <!-- Registro del Service Worker para funcionamiento PWA (Offline) -->
  <script>
    if ('serviceWorker' in navigator) {{
      window.addEventListener('load', () => {{
        navigator.serviceWorker.register('sw.js')
          .then(reg => console.log('Service Worker registrado con éxito!', reg))
          .catch(err => console.warn('Error al registrar el Service Worker:', err));
      }});
    }}
  </script>
</body>
</html>
"""

    # Escribir index.html local
    with open(local_index_path, 'w', encoding='utf-8') as f:
        f.write(html_template)
    print(f"✅ Local index.html escrito con éxito en: {local_index_path}")

    # Escribir previsualizacion-comedorcsb.html global
    with open(global_preview_path, 'w', encoding='utf-8') as f:
        f.write(html_template)
    print(f"✅ Global preview escrito con éxito en: {global_preview_path}")

except Exception as e:
    print(f"❌ Error al compilar: {e}")
