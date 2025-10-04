(function () {
  if (typeof THREE === 'undefined') {
    console.error('THREE.js ist erforderlich, um BufferGeometryUtils zu verwenden.');
    return;
  }

  const utils = THREE.BufferGeometryUtils || (THREE.BufferGeometryUtils = {});

  utils.mergeBufferGeometries = function (geometries) {
    if (!Array.isArray(geometries) || geometries.length === 0) {
      return null;
    }

    const filtered = geometries.filter(geometry => geometry && geometry.isBufferGeometry);
    if (filtered.length === 0) {
      return null;
    }

    const baseGeometry = filtered[0];
    const attributeNames = Object.keys(baseGeometry.attributes);
    const mergedGeometry = new THREE.BufferGeometry();

    attributeNames.forEach(name => {
      const firstAttribute = baseGeometry.attributes[name];
      if (!firstAttribute) {
        throw new Error(`Attribut "${name}" fehlt in der Basisgeometrie.`);
      }
      let ArrayType = firstAttribute.array.constructor;
      let totalLength = 0;

      filtered.forEach(geometry => {
        const attribute = geometry.attributes[name];
        if (!attribute) {
          throw new Error(`Attribut "${name}" fehlt in einer der Geometrien.`);
        }
        if (attribute.itemSize !== firstAttribute.itemSize) {
          throw new Error(`Uneinheitliche itemSize für Attribut "${name}".`);
        }
        if (attribute.array.constructor !== ArrayType) {
          ArrayType = Float32Array;
        }
        totalLength += attribute.array.length;
      });

      const mergedArray = new ArrayType(totalLength);
      let offset = 0;
      filtered.forEach(geometry => {
        const attribute = geometry.attributes[name];
        mergedArray.set(attribute.array, offset);
        offset += attribute.array.length;
      });

      mergedGeometry.setAttribute(name, new THREE.BufferAttribute(mergedArray, firstAttribute.itemSize, firstAttribute.normalized));
    });

    return mergedGeometry;
  };
})();
