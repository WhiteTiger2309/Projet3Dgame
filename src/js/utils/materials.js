import * as BABYLON from "@babylonjs/core";

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

export function createTiledTexture(scene, url, {
    uScale = 1,
    vScale = 1,
    isColor = true,
    anisotropy = 8,
    samplingMode = BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
} = {}) {
    const texture = new BABYLON.Texture(url, scene, true, false, samplingMode);
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.uScale = uScale;
    texture.vScale = vScale;

    texture.gammaSpace = !!isColor;
    texture.anisotropicFilteringLevel = anisotropy;

    return texture;
}

export function createSciFiPanelTexture(scene, name, {
    size = 512,
    grid = 64,
    lineAlpha = 0.18,
    microNoiseAlpha = 0.06,
} = {}) {
    const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
    const ctx = dt.getContext();

    ctx.clearRect(0, 0, size, size);

    // Base (almost white, so we can tint via material color)
    ctx.fillStyle = "#f2f4f7";
    ctx.fillRect(0, 0, size, size);

    // Big panels
    ctx.strokeStyle = `rgba(40, 50, 60, ${clamp01(lineAlpha)})`;
    ctx.lineWidth = 2;
    for (let x = 0; x <= size; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, size);
        ctx.stroke();
    }
    for (let y = 0; y <= size; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(size, y + 0.5);
        ctx.stroke();
    }

    // Secondary small lines
    ctx.strokeStyle = `rgba(20, 25, 30, ${clamp01(lineAlpha * 0.8)})`;
    ctx.lineWidth = 1;
    const halfGrid = Math.max(8, Math.floor(grid / 2));
    for (let x = 0; x <= size; x += halfGrid) {
        if (x % grid === 0) continue;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, size);
        ctx.stroke();
    }

    // Bolts
    ctx.fillStyle = `rgba(10, 15, 18, ${clamp01(lineAlpha + 0.12)})`;
    const boltR = Math.max(2, Math.floor(size / 256));
    for (let x = boltR * 4; x < size; x += grid) {
        for (let y = boltR * 4; y < size; y += grid) {
            ctx.beginPath();
            ctx.arc(x, y, boltR, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Micro noise
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    const strength = Math.floor(255 * clamp01(microNoiseAlpha));
    for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() * 2 - 1) * strength;
        data[i] = clamp01((data[i] + n) / 255) * 255;
        data[i + 1] = clamp01((data[i + 1] + n) / 255) * 255;
        data[i + 2] = clamp01((data[i + 2] + n) / 255) * 255;
    }
    ctx.putImageData(imageData, 0, 0);

    dt.update();
    return dt;
}

export function createSciFiEmissiveLinesTexture(scene, name, {
    size = 512,
    grid = 96,
    lineAlpha = 0.9,
    boltAlpha = 0.85,
    color = new BABYLON.Color3(0.0, 0.95, 1.0),
} = {}) {
    const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
    const ctx = dt.getContext();

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, size, size);

    const r = Math.round(clamp01(color.r) * 255);
    const g = Math.round(clamp01(color.g) * 255);
    const b = Math.round(clamp01(color.b) * 255);

    // Main panel lines
    ctx.strokeStyle = `rgba(${r},${g},${b},${clamp01(lineAlpha)})`;
    ctx.lineWidth = 2;
    for (let x = 0; x <= size; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, size);
        ctx.stroke();
    }
    for (let y = 0; y <= size; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(size, y + 0.5);
        ctx.stroke();
    }

    // Secondary thinner lines
    ctx.strokeStyle = `rgba(${r},${g},${b},${clamp01(lineAlpha * 0.55)})`;
    ctx.lineWidth = 1;
    const halfGrid = Math.max(12, Math.floor(grid / 2));
    for (let x = 0; x <= size; x += halfGrid) {
        if (x % grid === 0) continue;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, size);
        ctx.stroke();
    }

    // Bolts
    ctx.fillStyle = `rgba(${r},${g},${b},${clamp01(boltAlpha)})`;
    const boltR = Math.max(2, Math.floor(size / 256));
    for (let x = boltR * 4; x < size; x += grid) {
        for (let y = boltR * 4; y < size; y += grid) {
            ctx.beginPath();
            ctx.arc(x, y, boltR, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    dt.update();
    return dt;
}

export function createMetalFloorTexture(scene, name, {
    size = 1024,
    panel = 192,
    seamAlpha = 0.22,
    grooveAlpha = 0.14,
    microNoiseAlpha = 0.05,
} = {}) {
    const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
    const ctx = dt.getContext();

    ctx.clearRect(0, 0, size, size);

    // Base metal paint
    ctx.fillStyle = "#e7eaee";
    ctx.fillRect(0, 0, size, size);

    // Big plate seams
    ctx.strokeStyle = `rgba(25, 30, 36, ${clamp01(seamAlpha)})`;
    ctx.lineWidth = 3;
    for (let x = 0; x <= size; x += panel) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, size);
        ctx.stroke();
    }
    for (let y = 0; y <= size; y += panel) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(size, y + 0.5);
        ctx.stroke();
    }

    // Grooves inside plates
    ctx.strokeStyle = `rgba(15, 18, 22, ${clamp01(grooveAlpha)})`;
    ctx.lineWidth = 1;
    const grooveStep = Math.max(16, Math.floor(panel / 6));
    for (let y0 = 0; y0 < size; y0 += panel) {
        for (let x0 = 0; x0 < size; x0 += panel) {
            for (let gx = x0 + grooveStep; gx < x0 + panel; gx += grooveStep) {
                ctx.beginPath();
                ctx.moveTo(gx + 0.5, y0 + 6);
                ctx.lineTo(gx + 0.5, y0 + panel - 6);
                ctx.stroke();
            }
        }
    }

    // Rivets / bolts near corners
    ctx.fillStyle = `rgba(10, 12, 16, ${clamp01(seamAlpha + 0.12)})`;
    const boltR = Math.max(2, Math.floor(size / 384));
    const inset = Math.max(10, Math.floor(panel * 0.12));
    for (let x0 = 0; x0 < size; x0 += panel) {
        for (let y0 = 0; y0 < size; y0 += panel) {
            const corners = [
                [x0 + inset, y0 + inset],
                [x0 + panel - inset, y0 + inset],
                [x0 + inset, y0 + panel - inset],
                [x0 + panel - inset, y0 + panel - inset],
            ];
            for (const [x, y] of corners) {
                ctx.beginPath();
                ctx.arc(x, y, boltR, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Subtle dirt / noise to avoid flatness
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    const strength = Math.floor(255 * clamp01(microNoiseAlpha));
    for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() * 2 - 1) * strength;
        data[i] = clamp01((data[i] + n) / 255) * 255;
        data[i + 1] = clamp01((data[i + 1] + n) / 255) * 255;
        data[i + 2] = clamp01((data[i + 2] + n) / 255) * 255;
    }
    ctx.putImageData(imageData, 0, 0);

    dt.update();
    return dt;
}

export function createPbrPanelMaterial(scene, name, {
    baseColor = new BABYLON.Color3(0.25, 0.26, 0.30),
    emissiveColor = BABYLON.Color3.Black(),
    emissiveTexture = null,
    texture = null,
    textureUScale = 1,
    textureVScale = 1,
    metallic = 0.15,
    roughness = 0.75,
    environmentIntensity = null,
} = {}) {
    const mat = new BABYLON.PBRMaterial(name, scene);

    mat.albedoColor = baseColor;
    mat.metallic = clamp01(metallic);
    mat.roughness = clamp01(roughness);
    mat.emissiveColor = emissiveColor;

    if (emissiveTexture) {
        mat.emissiveTexture = emissiveTexture;
        mat.emissiveTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
        mat.emissiveTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
        mat.emissiveTexture.gammaSpace = true;
        mat.emissiveTexture.anisotropicFilteringLevel = 4;
        mat.emissiveTexture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    }

    if (texture) {
        mat.albedoTexture = texture;
        mat.albedoTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
        mat.albedoTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
        mat.albedoTexture.uScale = textureUScale;
        mat.albedoTexture.vScale = textureVScale;
        mat.albedoTexture.gammaSpace = true;
        mat.albedoTexture.anisotropicFilteringLevel = 8;
        mat.albedoTexture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    }

    // Keep things stable under strong lights.
    mat.usePhysicalLightFalloff = true;

    if (typeof environmentIntensity === "number") {
        mat.environmentIntensity = environmentIntensity;
    }

    return mat;
}

export function createEmissiveStripTexture(scene, name, {
    size = 256,
    orientation = "vertical", // 'vertical' | 'horizontal'
    style = "stripe", // 'stripe' | 'outline'
    stripeWidth = 0.14, // fraction of size
    glowWidth = 0.22, // fraction of size
    outlineWidth = 0.08, // fraction of size (for 'outline')
    outlineGlow = 0.16, // fraction of size (for 'outline')
    color = new BABYLON.Color3(0.15, 0.7, 1.0),
    intensity = 1.0,
} = {}) {
    const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
    const ctx = dt.getContext();

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "rgb(0,0,0)";
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const stripePx = Math.max(1, Math.floor(size * clamp01(stripeWidth)));
    const glowPx = Math.max(stripePx + 1, Math.floor(size * clamp01(glowWidth)));

    const r = Math.round(clamp01(color.r) * 255);
    const g = Math.round(clamp01(color.g) * 255);
    const b = Math.round(clamp01(color.b) * 255);
    // Slightly stronger glow helps the neon look without requiring a thick outline.
    const coreA = clamp01(1.0 * intensity);
    const glowA = clamp01(0.55 * intensity);

    if (style === "outline") {
        const borderPx = Math.max(1, Math.floor(size * clamp01(outlineWidth)));
        const glowPx = Math.max(borderPx + 1, Math.floor(size * clamp01(outlineGlow)));

        // Outer glow (soft)
        ctx.save();
        ctx.strokeStyle = `rgba(${r},${g},${b},${glowA})`;
        ctx.lineWidth = glowPx;
        ctx.shadowColor = `rgba(${r},${g},${b},${glowA})`;
        ctx.shadowBlur = Math.floor(glowPx * 1.05);
        const insetGlow = Math.floor(glowPx / 2);
        ctx.strokeRect(insetGlow, insetGlow, size - insetGlow * 2, size - insetGlow * 2);
        ctx.restore();

        // Core outline (crisp)
        ctx.save();
        ctx.strokeStyle = `rgba(${r},${g},${b},${coreA})`;
        ctx.lineWidth = borderPx;
        const insetCore = Math.floor(borderPx / 2);
        ctx.strokeRect(insetCore, insetCore, size - insetCore * 2, size - insetCore * 2);
        ctx.restore();

        dt.update();
        return dt;
    }

    if (orientation === "horizontal") {
        const y0 = Math.floor(cy - glowPx / 2);
        const y1 = Math.floor(cy + glowPx / 2);
        const grad = ctx.createLinearGradient(0, y0, 0, y1);
        grad.addColorStop(0.0, `rgba(${r},${g},${b},0.0)`);
        grad.addColorStop(0.5 - (stripePx / glowPx) * 0.5, `rgba(${r},${g},${b},${glowA})`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},${coreA})`);
        grad.addColorStop(0.5 + (stripePx / glowPx) * 0.5, `rgba(${r},${g},${b},${glowA})`);
        grad.addColorStop(1.0, `rgba(${r},${g},${b},0.0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, y0, size, y1 - y0);
    } else {
        const x0 = Math.floor(cx - glowPx / 2);
        const x1 = Math.floor(cx + glowPx / 2);
        const grad = ctx.createLinearGradient(x0, 0, x1, 0);
        grad.addColorStop(0.0, `rgba(${r},${g},${b},0.0)`);
        grad.addColorStop(0.5 - (stripePx / glowPx) * 0.5, `rgba(${r},${g},${b},${glowA})`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},${coreA})`);
        grad.addColorStop(0.5 + (stripePx / glowPx) * 0.5, `rgba(${r},${g},${b},${glowA})`);
        grad.addColorStop(1.0, `rgba(${r},${g},${b},0.0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x0, 0, x1 - x0, size);
    }

    dt.update();
    return dt;
}

export function createFlareTexture(scene, name = "flare_dt", { size = 128 } = {}) {
    const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
    const ctx = dt.getContext();

    ctx.clearRect(0, 0, size, size);

    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, "rgba(255,255,255,1.0)");
    g.addColorStop(0.25, "rgba(255,220,180,0.85)");
    g.addColorStop(0.55, "rgba(255,120,40,0.35)");
    g.addColorStop(1.0, "rgba(0,0,0,0.0)");

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    dt.hasAlpha = true;
    dt.update();
    return dt;
}

export function createFireTexture(scene, name = "fire_dt", { width = 256, height = 512 } = {}) {
    const dt = new BABYLON.DynamicTexture(name, { width, height }, scene, true);
    const ctx = dt.getContext();

    ctx.clearRect(0, 0, width, height);

    // Simple vertical flame gradient + a bit of noise
    const g = ctx.createLinearGradient(0, height, 0, 0);
    g.addColorStop(0.0, "rgba(0,0,0,0.0)");
    g.addColorStop(0.15, "rgba(180,40,10,0.25)");
    g.addColorStop(0.45, "rgba(255,90,20,0.65)");
    g.addColorStop(0.75, "rgba(255,190,70,0.85)");
    g.addColorStop(1.0, "rgba(255,255,255,0.75)");

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let y = 0; y < height; y++) {
        const rowJitter = (Math.random() * 2 - 1) * 18;
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const n = (Math.random() * 2 - 1) * 22 + rowJitter;
            data[i] = clamp01((data[i] + n) / 255) * 255;
            data[i + 1] = clamp01((data[i + 1] + n * 0.7) / 255) * 255;
            data[i + 2] = clamp01((data[i + 2] + n * 0.4) / 255) * 255;
            // Alpha: stronger towards top
            data[i + 3] = clamp01((data[i + 3] / 255) * (0.45 + (y / height) * 0.55)) * 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);

    dt.hasAlpha = true;
    dt.update();
    return dt;
}
