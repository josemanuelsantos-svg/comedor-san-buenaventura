import os
import re

file_path = '/Users/jose/.gemini/antigravity/scratch/previsualizacion-comedorcsb.html'

if not os.path.exists(file_path):
    print("❌ Could not find compiled HTML file at:", file_path)
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

print("Iniciando validación de la aplicación compilada...")

errors = 0

# 1. Comprobar que contiene el div raíz
if 'id="app-root"' not in content:
    print("❌ ERROR: Falta el div raíz id='app-root'")
    errors += 1
else:
    print("✅ Contiene div app-root.")

# 2. Comprobar CDNs de React, Babel, Tailwind, etc.
cdns = [
    ("Tailwind Play CDN", "cdn.tailwindcss.com"),
    ("React Core", "unpkg.com/react@18.2.0"),
    ("ReactDOM", "unpkg.com/react-dom@18.2.0"),
    ("Babel Standalone", "unpkg.com/@babel/standalone"),
    ("Confetti Library", "cdn.jsdelivr.net/npm/canvas-confetti"),
]

for name, url in cdns:
    if url not in content:
        print(f"❌ ERROR: Falta CDN de {name} ({url})")
        errors += 1
    else:
        print(f"✅ CDN de {name} encontrado.")

# 3. Comprobar que contiene la configuración de Firebase
if 'apiKey: "AIzaSyBlgbaGrSIjdaqXI0SVbZgdim5z8uNzBxs"' not in content:
    print("❌ ERROR: Falta la configuración oficial de Firebase.")
    errors += 1
else:
    print("✅ Configuración de Firebase encontrada.")

# 4. Comprobar elementos del DOM/estilos esperados
if 'dark:bg-slate-900' not in content:
    print("❌ ERROR: Falta la configuración de Tailwind para modo oscuro en el body.")
    errors += 1
else:
    print("✅ Estilos de modo oscuro integrados.")

# 5. Comprobar que el script JSX está cargado
if 'type="text/babel"' not in content:
    print("❌ ERROR: Falta el bloque de script transpiled por Babel <script type='text/babel'>")
    errors += 1
else:
    print("✅ Bloque script Babel encontrado.")

# 6. Comprobar la presencia de los componentes principales en el JSX
components = ["TeacherView", "AdminView", "SettingsView", "App", "enableIndexedDbPersistence"]
for comp in components:
    if comp not in content:
        print(f"❌ ERROR: No se encontró la definición de '{comp}' en el código JSX.")
        errors += 1
    else:
        print(f"✅ Componente/Función '{comp}' encontrado en el JSX.")

if errors == 0:
    print("\n🎉 ¡TODAS LAS VALIDACIONES DE ESTRUCTURA Y COMPONENTES COMPLETADAS CON ÉXITO! 🎉")
    print("La aplicación está lista para ser probada abriendo el archivo en cualquier navegador.")
else:
    print(f"\n❌ Se encontraron {errors} errores en la validación.")
    exit(1)
