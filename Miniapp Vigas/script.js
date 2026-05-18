// ==========================================
// 1. CAPTURA DE ELEMENTOS DE LA INTERFAZ
// ==========================================
const inputs = ['base', 'altura', 'humedad', 'cargaMuerta', 'cargaViva', 'luz', 'espaciamiento'];
const elements = {};
inputs.forEach(id => {
    elements[id] = document.getElementById(id);
});

// Elementos dinámicos de texto para los sliders
const luzVal = document.getElementById('luzVal');
const espaciamientoVal = document.getElementById('espaciamientoVal');

// Elementos de las tarjetas de resultados
const cardFlexion = document.getElementById('card-flexion');
const txtFlexion = document.getElementById('txt-flexion');

const cardCorte = document.getElementById('card-corte');
const txtCorte = document.getElementById('txt-corte');

const cardDeflexion = document.getElementById('card-deflexion');
const txtDeflexionTot = document.getElementById('txt-deflexion-tot');
const txtDeflexionViva = document.getElementById('txt-deflexion-viva');

// Elementos de LaTeX
const latexOutput = document.getElementById('latex-output');
const btnCopy = document.getElementById('btn-copy');

// Propiedades Base Pino Radiata G1 (en MPa o N/mm²)
const F_f_base = 9.2;
const F_v_base = 1.1;
const E_prom_base = 10000;
const E_min_base = 6000;

// ==========================================
// 2. FUNCIÓN PRINCIPAL DE CÁLCULO
// ==========================================
function calcular() {
    // Obtener valores numéricos actualizados
    const b = parseFloat(elements.base.value);
    const h = parseFloat(elements.altura.value);
    const Hs = parseFloat(elements.humedad.value);
    const D = parseFloat(elements.cargaMuerta.value);
    const Lf = parseFloat(elements.cargaViva.value);
    const L = parseFloat(elements.luz.value); // en metros
    const e = parseFloat(elements.espaciamiento.value); // en mm

    // Actualizar etiquetas de los sliders en pantalla
    luzVal.textContent = L.toFixed(1);
    espaciamientoVal.textContent = e;

    // Convertir unidades clave
    const L_mm = L * 1000;
    const e_m = e / 1000;

    // --- ACCIONES Y CARGAS ---
    const Q_total_kg_m2 = D + Lf;
    const q_total_kg_m = Q_total_kg_m2 * e_m;
    const q_viva_kg_m = Lf * e_m;

    // Convertir carga distribuida a N/mm (1 kg/m = 9.81 N / 1000 mm = 0.00981 N/mm)
    const q_tot_Nmm = q_total_kg_m * 0.00981;
    const q_viva_Nmm = q_viva_kg_m * 0.00981;

    // --- ESFUERZOS INTERNOS (MÁXIMOS) ---
    const M_max = (q_tot_Nmm * Math.pow(L_mm, 2)) / 8; // N*mm
    const V_max = (q_tot_Nmm * L_mm) / 2; // N

    // --- PROPIEDADES GEOMÉTRICAS ---
    const Wn = (b * Math.pow(h, 2)) / 6; // Módulo de sección (mm³)
    const I = (b * Math.pow(h, 3)) / 12; // Inercia (mm⁴)
    const A = b * h; // Área (mm²)

    // ==========================================
    // 3. FACTORES DE MODIFICACIÓN (NCh 1198)
    // ==========================================
    
    // Factor de Humedad (KH)
    let KH_flexion_corte = 1.0;
    let KH_E = 1.0;
    if (Hs > 12) {
        KH_flexion_corte = Math.max(0.5, 1 - 0.02 * (Hs - 12));
        KH_E = Math.max(0.5, 1 - 0.017 * (Hs - 12));
    }

    // Factor de Duración de Carga (KD) -> Combinación D + Lf (Sobrecarga de piso = 1.0)
    const KD = 1.0;

    // Factor de Trabajo Conjunto (Kc) -> 1.15 si espaciamiento es <= 610mm
    const Kc = (e <= 610) ? 1.15 : 1.0;

    // Factor de Altura (Khf) -> Para flexión si h > 140mm
    let Khf = 1.0;
    if (h > 140) {
        Khf = Math.pow(140 / h, 0.22);
    }

    // --- TENSIONES Y MÓDULOS DE DISEÑO ---
    const F_f_dis = F_f_base * KH_flexion_corte * KD * Kc * Khf;
    const F_v_dis = F_v_base * KH_flexion_corte * KD * Kc;
    
    // Elige Madera aplica un factor de 0.6 al módulo base para el cálculo analítico
    const E_dis_tot = 0.6 * E_prom_base * KH_E; 
    const E_dis_viva = 0.6 * E_min_base * KH_E; 

    // ==========================================
    // 4. VERIFICACIONES DE ESTADOS LÍMITE
    // ==========================================

    // A) FLEXIÓN
    const f_f = M_max / Wn; // Tensión de trabajo
    const cumpleFlexion = f_f <= F_f_dis;
    actualizarTarjeta(cardFlexion, txtFlexion, cumpleFlexion, `f_f = ${f_f.toFixed(2)} MPa ≤ F_f,dis = ${F_f_dis.toFixed(2)} MPa`);

    // B) CORTE (CIZALLE)
    const f_v = (1.5 * V_max) / A; // Tensión de trabajo en corte
    const cumpleCorte = f_v <= F_v_dis;
    actualizarTarjeta(cardCorte, txtCorte, cumpleCorte, `f_v = ${f_v.toFixed(2)} MPa ≤ F_v,dis = ${F_v_dis.toFixed(2)} MPa`);

    // C) DEFLEXIÓN (DEFORMACIÓN)
    // Deformación Real Total (Carga Muerta + Viva)
    const def_tot_real = (5 * q_tot_Nmm * Math.pow(L_mm, 4)) / (384 * E_dis_tot * I);
    const def_tot_adm = L_mm / 300;
    const cumpleDefTot = def_tot_real <= def_tot_adm;

    // Deformación Real Viva (Solo Sobrecarga)
    const def_viva_real = (5 * q_viva_Nmm * Math.pow(L_mm, 4)) / (384 * E_dis_viva * I);
    const def_viva_adm = L_mm / 360;
    const cumpleDefViva = def_viva_real <= def_viva_adm;

    const cumpleDeflexion = cumpleDefTot && cumpleDefViva;
    
    // Actualizamos visualmente la tarjeta de deflexión
    cardDeflexion.className = `result-card ${cumpleDeflexion ? 'state-success' : 'state-danger'}`;
    txtDeflexionTot.innerHTML = `Total (L/300): Real <strong>${def_tot_real.toFixed(1)} mm</strong> vs Adm <strong>${def_tot_adm.toFixed(1)} mm</strong> (${cumpleDefTot ? 'OK' : 'X'})`;
    txtDeflexionViva.innerHTML = `Sobrecarga (L/360): Real <strong>${def_viva_real.toFixed(1)} mm</strong> vs Adm <strong>${def_viva_adm.toFixed(1)} mm</strong> (${cumpleDefViva ? 'OK' : 'X'})`;

    // ==========================================
    // 5. GENERACIÓN AUTOMÁTICA DE LATEX
    // ==========================================
    const latexText = `\\section*{Memoria de Cálculo Estructural - NCh 1198}
\\textbf{Carga de diseño:} $q_{tot} = ${q_total_kg_m.toFixed(1)} \\text{ kg/m} \\rightarrow ${q_tot_Nmm.toFixed(3)} \\text{ N/mm}$ \\\\
\\textbf{Factores:} $K_H = ${KH_flexion_corte.toFixed(3)}$, $K_D = ${KD.toFixed(1)}$, $K_c = ${Kc.toFixed(2)}$, $K_{hf} = ${Khf.toFixed(3)}$ \\\\

\\subsection*{1. Verificación a Flexión}
$M_{max} = \\frac{q \\cdot L^2}{8} = \\frac{${q_tot_Nmm.toFixed(3)} \\cdot ${L_mm}^2}{8} = ${M_max.getScientific()}$ N$\\cdot$mm \\\\
$f_f = \\frac{M_{max}}{W_n} = ${f_f.toFixed(2)} \\text{ MPa} \\quad \\text{vs} \\quad F_{f,dis} = ${F_f_dis.toFixed(2)} \\text{ MPa}$ 
$\\rightarrow$ \\textbf{${cumpleFlexion ? 'CUMPLE' : 'NO CUMPLE'}}$ \\\\

\\subsection*{2. Verificación a Corte}
$V_{max} = \\frac{q \\cdot L}{2} = ${V_max.toFixed(1)}$ N \\\\
$f_v = \\frac{1.5 \\cdot V_{max}}{A} = ${f_v.toFixed(2)} \\text{ MPa} \\quad \\text{vs} \\quad F_{v,dis} = ${F_v_dis.toFixed(2)} \\text{ MPa}$
$\\rightarrow$ \\textbf{${cumpleCorte ? 'CUMPLE' : 'NO CUMPLE'}}$ \\\\

\\subsection*{3. Control de Deflexión}
$\\delta_{tot} = \\frac{5 \\cdot q_{tot} \\cdot L^4}{384 \\cdot E_{dis} \\cdot I} = ${def_tot_real.toFixed(1)} \\text{ mm} \\le \\frac{L}{300} = ${def_tot_adm.toFixed(1)} \\text{ mm}$ \\\\
$\\delta_{viva} = \\frac{5 \\cdot q_{viva} \\cdot L^4}{384 \\cdot E_{dis,min} \\cdot I} = ${def_viva_real.toFixed(1)} \\text{ mm} \\le \\frac{L}{360} = ${def_viva_adm.toFixed(1)} \\text{ mm}$
$\\rightarrow$ \\textbf{${cumpleDeflexion ? 'CUMPLE' : 'NO CUMPLE'}}$`;

    latexOutput.value = latexText;
}

// ==========================================
// 6. FUNCIONES AUXILIARES (Van fuera de calcular)
// ==========================================

// Auxiliar para aplicar el formato científico en LaTeX si el número es muy grande
Number.prototype.getScientific = function() {
    return this.toExponential(2).replace('e+', '\\cdot 10^{') + '}';
};

// Auxiliar para cambiar el color de las tarjetas de resultados
function actualizarTarjeta(card, textElement, cumple, mensaje) {
    if (cumple) {
        card.className = "result-card state-success";
        textElement.innerHTML = `<strong>CUMPLE:</strong> ${mensaje}`;
    } else {
        card.className = "result-card state-danger";
        textElement.innerHTML = `<strong>NO CUMPLE:</strong> ${mensaje}`;
    }
}

// ==========================================
// 7. EVENTOS DE ESCUCHA (Interactividad)
// ==========================================
// Escuchar cuando cambie cualquier input o slider para recalcular de inmediato
inputs.forEach(id => {
    elements[id].addEventListener('input', calcular);
});

// Botón para copiar el código LaTeX
btnCopy.addEventListener('click', () => {
    latexOutput.select();
    document.execCommand('copy');
    alert('¡Código LaTeX copiado al portapapeles!');
});

// Ejecutar el primer cálculo al cargar la página
calcular();