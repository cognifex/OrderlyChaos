(function () {
  if (typeof THREE === 'undefined') {
    console.error('THREE.js ist erforderlich, um STLLoader zu verwenden.');
    return;
  }

  const LITTLE_ENDIAN = true;
  const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

  function ensureArrayBuffer(data) {
    if (data instanceof ArrayBuffer) {
      return data;
    }
    if (ArrayBuffer.isView(data)) {
      return data.buffer;
    }
    return null;
  }

  function isBinary(buffer) {
    if (!buffer || buffer.byteLength < 84) {
      return false;
    }
    const view = new DataView(buffer);
    const faceCount = view.getUint32(80, LITTLE_ENDIAN);
    const expectedSize = 84 + faceCount * 50;
    if (expectedSize === buffer.byteLength) {
      return true;
    }
    // Check header for ASCII signature
    let header = '';
    for (let i = 0; i < Math.min(5, buffer.byteLength); i++) {
      header += String.fromCharCode(view.getUint8(i));
    }
    return header.trim().toLowerCase() !== 'solid';
  }

  function decodeText(buffer) {
    if (!buffer) return '';
    if (typeof buffer === 'string') return buffer;
    if (textDecoder) {
      return textDecoder.decode(new Uint8Array(buffer));
    }
    const array = new Uint8Array(buffer);
    let out = '';
    for (let i = 0, l = array.length; i < l; i++) {
      out += String.fromCharCode(array[i]);
    }
    return out;
  }

  function parseBinary(buffer) {
    const view = new DataView(buffer);
    const faceCount = view.getUint32(80, LITTLE_ENDIAN);
    const positions = new Float32Array(faceCount * 9);
    const normals = new Float32Array(faceCount * 9);

    let offset = 84;
    let posIndex = 0;
    let normIndex = 0;

    for (let face = 0; face < faceCount; face++) {
      if (offset + 50 > buffer.byteLength) {
        break;
      }
      const nx = view.getFloat32(offset, LITTLE_ENDIAN);
      const ny = view.getFloat32(offset + 4, LITTLE_ENDIAN);
      const nz = view.getFloat32(offset + 8, LITTLE_ENDIAN);
      offset += 12;

      for (let i = 0; i < 3; i++) {
        const x = view.getFloat32(offset, LITTLE_ENDIAN);
        const y = view.getFloat32(offset + 4, LITTLE_ENDIAN);
        const z = view.getFloat32(offset + 8, LITTLE_ENDIAN);
        positions[posIndex++] = x;
        positions[posIndex++] = y;
        positions[posIndex++] = z;
        normals[normIndex++] = nx;
        normals[normIndex++] = ny;
        normals[normIndex++] = nz;
        offset += 12;
      }

      offset += 2; // attribute byte count
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function parseASCII(text) {
    const data = decodeText(text);
    const patternFace = /facet[\s\S]*?endfacet/gi;
    const patternNormal = /facet\s+normal\s+([eE0-9+\-.]+)\s+([eE0-9+\-.]+)\s+([eE0-9+\-.]+)/i;
    const patternVertex = /vertex\s+([eE0-9+\-.]+)\s+([eE0-9+\-.]+)\s+([eE0-9+\-.]+)/ig;

    const positions = [];
    const normals = [];
    const faces = data.match(patternFace) || [];

    faces.forEach(face => {
      const normalMatch = patternNormal.exec(face);
      const nx = normalMatch ? parseFloat(normalMatch[1]) : 0;
      const ny = normalMatch ? parseFloat(normalMatch[2]) : 0;
      const nz = normalMatch ? parseFloat(normalMatch[3]) : 0;
      patternNormal.lastIndex = 0;

      let vertexMatch;
      const localVertices = [];
      while ((vertexMatch = patternVertex.exec(face)) !== null) {
        const x = parseFloat(vertexMatch[1]);
        const y = parseFloat(vertexMatch[2]);
        const z = parseFloat(vertexMatch[3]);
        localVertices.push(x, y, z);
        positions.push(x, y, z);
        normals.push(nx, ny, nz);
      }
      patternVertex.lastIndex = 0;

      // If normals are zero, compute later.
      if (!normalMatch && localVertices.length >= 9) {
        const ax = localVertices[3] - localVertices[0];
        const ay = localVertices[4] - localVertices[1];
        const az = localVertices[5] - localVertices[2];
        const bx = localVertices[6] - localVertices[0];
        const by = localVertices[7] - localVertices[1];
        const bz = localVertices[8] - localVertices[2];
        const cx = ay * bz - az * by;
        const cy = az * bx - ax * bz;
        const cz = ax * by - ay * bx;
        const len = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
        const nxComputed = cx / len;
        const nyComputed = cy / len;
        const nzComputed = cz / len;
        for (let i = normals.length - 9; i < normals.length; i += 3) {
          normals[i] = nxComputed;
          normals[i + 1] = nyComputed;
          normals[i + 2] = nzComputed;
        }
      }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    if (normals.some(value => value !== 0)) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    } else {
      geometry.computeVertexNormals();
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function STLLoader() {}

  STLLoader.prototype = {
    constructor: STLLoader,

    parse: function (data) {
      if (typeof data === 'string') {
        return parseASCII(data);
      }
      const buffer = ensureArrayBuffer(data);
      if (!buffer) {
        throw new Error('Ungültige STL-Daten.');
      }
      return isBinary(buffer) ? parseBinary(buffer) : parseASCII(buffer);
    }
  };

  THREE.STLLoader = STLLoader;
})();
