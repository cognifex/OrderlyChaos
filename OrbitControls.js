/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 */

THREE.OrbitControls = function ( object, domElement ) {

	this.object = object;
	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// API

	this.enabled = true;

	this.target = new THREE.Vector3();

	this.minDistance = 0;
	this.maxDistance = Infinity;

	this.minZoom = 0;
	this.maxZoom = Infinity;

	this.minPolarAngle = 0; // radians
	this.maxPolarAngle = Math.PI; // radians

	this.minAzimuthAngle = - Infinity; // radians
	this.maxAzimuthAngle = Infinity; // radians

	this.enableDamping = false;
	this.dampingFactor = 0.05;

	this.enableZoom = true;
	this.zoomSpeed = 1.0;

	this.enableRotate = true;
	this.rotateSpeed = 1.0;

	this.enablePan = true;
	this.panSpeed = 1.0;
	this.screenSpacePanning = true;
	this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

	this.autoRotate = false;
	this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

	this.enableKeys = true;

	this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

	this.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

	this.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

	// internals

	const scope = this;

	const STATE = {
		NONE: - 1,
		ROTATE: 0,
		DOLLY: 1,
		PAN: 2,
		TOUCH_ROTATE: 3,
		TOUCH_PAN: 4,
		TOUCH_DOLLY_PAN: 5,
		TOUCH_DOLLY_ROTATE: 6
	};

	let state = STATE.NONE;

	const EPS = 0.000001;

	// current position in spherical coordinates
	const spherical = new THREE.Spherical();
	const sphericalDelta = new THREE.Spherical();

	let scale = 1;
	const panOffset = new THREE.Vector3();
	let zoomChanged = false;

	const rotateStart = new THREE.Vector2();
	const rotateEnd = new THREE.Vector2();
	const rotateDelta = new THREE.Vector2();

	const panStart = new THREE.Vector2();
	const panEnd = new THREE.Vector2();
	const panDelta = new THREE.Vector2();

	const dollyStart = new THREE.Vector2();
	const dollyEnd = new THREE.Vector2();
	const dollyDelta = new THREE.Vector2();
	function getAutoRotationAngle() {

		return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

	}

	function getZoomScale() {

		return Math.pow( 0.95, scope.zoomSpeed );

	}

	function rotateLeft( angle ) {

		sphericalDelta.theta -= angle;

	}

	function rotateUp( angle ) {

		sphericalDelta.phi -= angle;

	}

	const panLeft = ( function () {

		const v = new THREE.Vector3();

		return function panLeft( distance, objectMatrix ) {

			v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
			v.multiplyScalar( - distance );

			panOffset.add( v );

		};

	}() );

	const panUp = ( function () {

		const v = new THREE.Vector3();

		return function panUp( distance, objectMatrix ) {

			v.setFromMatrixColumn( objectMatrix, 1 ); // get Y column of objectMatrix
			v.multiplyScalar( distance );

			panOffset.add( v );

		};

	}() );

	// deltaX and deltaY are in pixels; right and down are positive
	const pan = ( function () {

		const offset = new THREE.Vector3();

		return function pan( deltaX, deltaY ) {

			const element = scope.domElement;

			if ( scope.object.isPerspectiveCamera ) {

				// perspective
				const position = scope.object.position;
				offset.copy( position ).sub( scope.target );
				let targetDistance = offset.length();

				// half of the fov is center to top of screen
				targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

				// we actually don't use screenWidth, since perspective camera is fixed to screen height
				panLeft( 2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix );
				panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );

			} else if ( scope.object.isOrthographicCamera ) {

				// orthographic
				panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth, scope.object.matrix );
				panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight, scope.object.matrix );

			} else {

				// camera neither orthographic nor perspective
				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
				scope.enablePan = false;

			}

		};

	}() );

	function dollyIn( dollyScale ) {

		if ( scope.object.isPerspectiveCamera ) {

			scale /= dollyScale;

		} else if ( scope.object.isOrthographicCamera ) {

			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom * dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;

		}

	}

	function dollyOut( dollyScale ) {

		if ( scope.object.isPerspectiveCamera ) {

			scale *= dollyScale;

		} else if ( scope.object.isOrthographicCamera ) {

			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;

		}

	}
	//
	// event callbacks - update the object state
	//

	function handleMouseDownRotate( event ) {

		rotateStart.set( event.clientX, event.clientY );

	}

	function handleMouseDownDolly( event ) {

		dollyStart.set( event.clientX, event.clientY );

	}

	function handleMouseDownPan( event ) {

		panStart.set( event.clientX, event.clientY );

	}

	function handleMouseMoveRotate( event ) {

		rotateEnd.set( event.clientX, event.clientY );

		rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );

		const element = scope.domElement;

		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height

		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );

		rotateStart.copy( rotateEnd );

		scope.update();

	}

	function handleMouseMoveDolly( event ) {

		dollyEnd.set( event.clientX, event.clientY );

		dollyDelta.subVectors( dollyEnd, dollyStart );

		if ( dollyDelta.y > 0 ) {

			dollyIn( getZoomScale() );

		} else if ( dollyDelta.y < 0 ) {

			dollyOut( getZoomScale() );

		}

		dollyStart.copy( dollyEnd );

		scope.update();

	}

	function handleMouseMovePan( event ) {

		panEnd.set( event.clientX, event.clientY );

		panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );

		pan( panDelta.x, panDelta.y );

		panStart.copy( panEnd );

		scope.update();

	}

	function handleMouseUp( /*event*/ ) {

		// no-op

	}

	function handleMouseWheel( event ) {

		if ( event.deltaY < 0 ) {

			dollyOut( getZoomScale() );

		} else if ( event.deltaY > 0 ) {

			dollyIn( getZoomScale() );

		}

		scope.update();

	}

	function handleKeyDown( event ) {

		let needsUpdate = false;

		switch ( event.keyCode ) {

			case scope.keys.UP:
				pan( 0, scope.keyPanSpeed );
				needsUpdate = true;
				break;

			case scope.keys.BOTTOM:
				pan( 0, - scope.keyPanSpeed );
				needsUpdate = true;
				break;

			case scope.keys.LEFT:
				pan( scope.keyPanSpeed, 0 );
				needsUpdate = true;
				break;

			case scope.keys.RIGHT:
				pan( - scope.keyPanSpeed, 0 );
				needsUpdate = true;
				break;

		}

		if ( needsUpdate ) {

			// prevent the browser from scrolling on cursor keys
			event.preventDefault();

			scope.update();

		}

	}
	function handleTouchStartRotate( event ) {

		if ( event.touches.length == 1 ) {

			rotateStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

		} else {

			const x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
			const y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );

			rotateStart.set( x, y );

		}

	}

	function handleTouchStartPan( event ) {

		if ( event.touches.length == 1 ) {

			panStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

		} else {

			const x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
			const y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );

			panStart.set( x, y );

		}

	}

	function handleTouchStartDolly( event ) {

		const dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
		const dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

		const distance = Math.sqrt( dx * dx + dy * dy );

		dollyStart.set( 0, distance );

	}

	function handleTouchMoveRotate( event ) {

		if ( event.touches.length == 1 ) {

			rotateEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

		} else {

			const x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
			const y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );

			rotateEnd.set( x, y );

		}

		rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );

		const element = scope.domElement;

		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight );
		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );

		rotateStart.copy( rotateEnd );

		scope.update();

	}

	function handleTouchMovePan( event ) {

		if ( event.touches.length == 1 ) {

			panEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

		} else {

			const x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
			const y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );

			panEnd.set( x, y );

		}

		panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );
		pan( panDelta.x, panDelta.y );
		panStart.copy( panEnd );

		scope.update();

	}

	function handleTouchMoveDolly( event ) {

		const dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
		const dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

		const distance = Math.sqrt( dx * dx + dy * dy );

		dollyEnd.set( 0, distance );

		dollyDelta.subVectors( dollyEnd, dollyStart );

		if ( dollyDelta.y > 0 ) {

			dollyOut( getZoomScale() );

		} else if ( dollyDelta.y < 0 ) {

			dollyIn( getZoomScale() );

		}

		dollyStart.copy( dollyEnd );

		scope.update();

	}

	// misc helpers

	function handleTouchEnd( /*event*/ ) { /* no-op */ }

	//
	// event handlers
	//

	function onMouseDown( event ) {

		if ( scope.enabled === false ) return;

		switch ( event.button ) {

			case scope.mouseButtons.LEFT:
				if ( scope.enableRotate === false ) return;
				handleMouseDownRotate( event );
				state = STATE.ROTATE;
				break;

			case scope.mouseButtons.MIDDLE:
				if ( scope.enableZoom === false ) return;
				handleMouseDownDolly( event );
				state = STATE.DOLLY;
				break;

			case scope.mouseButtons.RIGHT:
				if ( scope.enablePan === false ) return;
				handleMouseDownPan( event );
				state = STATE.PAN;
				break;

		}

		if ( state !== STATE.NONE ) {

			scope.domElement.addEventListener( 'mousemove', onMouseMove );
			scope.domElement.addEventListener( 'mouseup', onMouseUp );

		}

	}

	function onMouseMove( event ) {

		if ( scope.enabled === false ) return;

		switch ( state ) {

			case STATE.ROTATE:
				if ( scope.enableRotate === false ) return;
				handleMouseMoveRotate( event );
				break;

			case STATE.DOLLY:
				if ( scope.enableZoom === false ) return;
				handleMouseMoveDolly( event );
				break;

			case STATE.PAN:
				if ( scope.enablePan === false ) return;
				handleMouseMovePan( event );
				break;

		}

	}

	function onMouseUp( event ) {

		scope.domElement.removeEventListener( 'mousemove', onMouseMove );
		scope.domElement.removeEventListener( 'mouseup', onMouseUp );

		state = STATE.NONE;

	}

	function onMouseWheel( event ) {

		if ( scope.enabled === false || scope.enableZoom === false || state !== STATE.NONE ) return;

		event.preventDefault();
		event.stopPropagation();

		handleMouseWheel( event );

	}

	function onKeyDown( event ) {

		if ( scope.enabled === false || scope.enableKeys === false || scope.enablePan === false ) return;

		handleKeyDown( event );

	}

	function onTouchStart( event ) {

		if ( scope.enabled === false ) return;

		switch ( event.touches.length ) {

			case 1:
				if ( scope.enableRotate === false ) return;
				handleTouchStartRotate( event );
				state = STATE.TOUCH_ROTATE;
				break;

			case 2:
				if ( scope.enableZoom === false && scope.enablePan === false ) return;
				if ( scope.enableZoom ) handleTouchStartDolly( event );
				if ( scope.enablePan ) handleTouchStartPan( event );
				state = STATE.TOUCH_DOLLY_PAN;
				break;

			default:
				state = STATE.NONE;

		}

		if ( state !== STATE.NONE ) {

			scope.domElement.addEventListener( 'touchmove', onTouchMove );
			scope.domElement.addEventListener( 'touchend', onTouchEnd );

		}

	}

	function onTouchMove( event ) {

		if ( scope.enabled === false ) return;

		switch ( state ) {

			case STATE.TOUCH_ROTATE:
				if ( scope.enableRotate === false ) return;
				handleTouchMoveRotate( event );
				break;

			case STATE.TOUCH_PAN:
				if ( scope.enablePan === false ) return;
				handleTouchMovePan( event );
				break;

			case STATE.TOUCH_DOLLY_PAN:
				if ( scope.enableZoom ) handleTouchMoveDolly( event );
				if ( scope.enablePan ) handleTouchMovePan( event );
				break;

			default:
				state = STATE.NONE;

		}

	}

	function onTouchEnd( event ) {

		scope.domElement.removeEventListener( 'touchmove', onTouchMove );
		scope.domElement.removeEventListener( 'touchend', onTouchEnd );

		state = STATE.NONE;

	}

	//
	// public methods
	//

	this.update = function () {

		const offset = new THREE.Vector3();

		// so camera.up is the orbit axis
		const quat = new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
		const quatInverse = quat.clone().invert();

		const lastPosition = new THREE.Vector3();
		const lastQuaternion = new THREE.Quaternion();

		return function update() {

			const position = scope.object.position;

			offset.copy( position ).sub( scope.target );

			// rotate offset to "y-axis-is-up" space
			offset.applyQuaternion( quat );

			// angle from z-axis around y-axis
			spherical.setFromVector3( offset );

			if ( scope.autoRotate && state === STATE.NONE ) {

				rotateLeft( getAutoRotationAngle() );

			}

			spherical.theta += sphericalDelta.theta;
			spherical.phi += sphericalDelta.phi;

			// restrict theta/phi
			spherical.theta = Math.max( scope.minAzimuthAngle, Math.min( scope.maxAzimuthAngle, spherical.theta ) );
			spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );
			spherical.makeSafe();

			spherical.radius *= scale;
			spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );

			// move target
			scope.target.add( panOffset );

			offset.setFromSpherical( spherical );
			offset.applyQuaternion( quatInverse );

			position.copy( scope.target ).add( offset );

			scope.object.lookAt( scope.target );

			if ( scope.enableDamping ) {

				sphericalDelta.theta *= ( 1 - scope.dampingFactor );
				sphericalDelta.phi *= ( 1 - scope.dampingFactor );

				panOffset.multiplyScalar( 1 - scope.dampingFactor );

			} else {

				sphericalDelta.set( 0, 0, 0 );
				panOffset.set( 0, 0, 0 );

			}

			scale = 1;

			if ( zoomChanged ||
				lastPosition.distanceToSquared( scope.object.position ) > EPS ||
				8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {

				lastPosition.copy( scope.object.position );
				lastQuaternion.copy( scope.object.quaternion );
				zoomChanged = false;

				return true;

			}

			return false;

		};

	}();

	// listeners
	this.dispose = function () {

		scope.domElement.removeEventListener( 'contextmenu', onContextMenu );
		scope.domElement.removeEventListener( 'mousedown', onMouseDown );
		scope.domElement.removeEventListener( 'wheel', onMouseWheel );

		scope.domElement.removeEventListener( 'touchstart', onTouchStart );
		scope.domElement.removeEventListener( 'touchend', onTouchEnd );
		scope.domElement.removeEventListener( 'touchmove', onTouchMove );

		scope.domElement.removeEventListener( 'keydown', onKeyDown );

	};

	function onContextMenu( event ) {

		event.preventDefault();

	}

	scope.domElement.addEventListener( 'contextmenu', onContextMenu );
	scope.domElement.addEventListener( 'mousedown', onMouseDown );
	scope.domElement.addEventListener( 'wheel', onMouseWheel );

	scope.domElement.addEventListener( 'touchstart', onTouchStart );
	scope.domElement.addEventListener( 'keydown', onKeyDown );

	// force an update at start
	this.update();

};

