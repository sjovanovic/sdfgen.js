/*
	Applies Signed Distance Field (SDF) algorithm to the input image in the browser via WebGL 
	Author: Slobodan Jovanovic
	Site: https://github.com/sjovanovic/sdfgen.js

	Usage:

	new SDFGen({
		inputImage:'input.png', 	// input image
		canvas:'#canvas', 			// output goes to canvas
		spread: 60 					// distance spread amount, default 10
	})
*/


var SDFGen = function(options){
	var uniforms = {
		u_image:{
			val:options.inputImage
		}
	}
	var spread = parseInt(options.spread?options.spread:10)
	return new RawGL({
		'canvas':options.canvas,
		'uniforms':uniforms,
		'floatTextures':true,
		'fragmentShader':"precision mediump float; \n\
		  uniform sampler2D u_image; \n\
		  uniform vec2 u_textureSize; \n\
		  varying vec2 v_texCoord; \n\
		  /*_uniforms*/ \n\
		  bool isBlack(vec4 col){ \n\
		  	if(col.r == 0.0 && col.g == 0.0 && col.b == 0.0){ return true; }else{ return false; } \n\
		  } \n\
		  // Midpoint circle algorithm https://en.wikipedia.org/wiki/Midpoint_circle_algorithm  \n\
		  bool isNearestRadius(int radius, vec2 coords, vec2 pixel){ \n\
		  	int x = radius; \n\
		    int y = 0; \n\
		    int err = 0; \n\
		    for(int i=0; i<512; i++){ \n\
		    	if (x >= y) { \n\
			    	// get the pixel at position and check if it's black if yes return true, if not continue \n\
			    	if(isBlack(texture2D(u_image, coords + pixel * vec2(x, y)))){ return true; } \n\
			    	if(isBlack(texture2D(u_image, coords + pixel * vec2(y, x)))){ return true; } \n\
			    	if(isBlack(texture2D(u_image, coords + pixel * vec2(-y, x)))){ return true; } \n\
			    	if(isBlack(texture2D(u_image, coords + pixel * vec2(-x, y)))){ return true; } \n\
			    	if(isBlack(texture2D(u_image, coords + pixel * vec2(-x, -y)))){ return true; } \n\
			    	if(isBlack(texture2D(u_image, coords + pixel * vec2(-y, -x)))){ return true; } \n\
			    	if(isBlack(texture2D(u_image, coords + pixel * vec2(y, -x)))){ return true; } \n\
			    	if(isBlack(texture2D(u_image, coords + pixel * vec2(x, -y)))){ return true; } \n\
			        if (err <= 0) { \n\
			            y += 1; \n\
			            err += 2*y + 1; \n\
			        } \n\
			        if (err > 0) { \n\
			            x -= 1; \n\
			            err -= 2*x + 1; \n\
			        } \n\
			    }else{ break; } \n\
		    } \n\
		    return false; \n\
		  } \n\
		  void main() { \n\
		  	vec2 onePixel = vec2(1.0, 1.0) / u_textureSize; \n\
		  	const int maxRadius = "+spread+"; \n\
		  	float shade = 1.00 / "+spread+".0; //0.020; \n\
		  	float intensity = 0.0; \n\
		  	vec4 sample = texture2D(u_image, v_texCoord); \n\
		  	if(isBlack(sample)){ \n\
		  		gl_FragColor = sample; \n\
		  	}else{ \n\
		  		for(int radius=1; radius<=maxRadius; radius++){ \n\
		      		if(isNearestRadius(radius, v_texCoord, onePixel)){ \n\
		      			intensity = float(radius) * shade; \n\
		      			break; \n\
		      		} \n\
		      	} \n\
		      	if(intensity != 0.0){ \n\
		      		gl_FragColor = vec4(intensity, intensity, intensity, 1.0); \n\
		      	}else{ \n\
		      		gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // white \n\
		      		//discard; \n\
		      	} \n\
		  	} \n\
		  }",
		'loaded':function(){
			this.setTexture("u_image", 0);
		  	this.setFramebuffer(null, this.canvas.width, this.canvas.height)
		  	this.setRectangle( this.gl, 0, 0, this.canvas.width, this.canvas.height);
		  	this.draw()
		}
  	})
}

/*
  Basic set of tools for 2d graphics in WebGL

  Usage example: Draw a image

  new RawGL({
    'canvas':'#raw_canvas',
    'uniforms':{
      'test_image':{'val':'img/5.png'}
    },
    'loaded':function(){
      this.setRectangle( this.gl, 0, 0, this.canvas.width, this.canvas.height);
      this.draw()
    }
  })

  

*/

function RawGL(options){
  var inst = this
  
  // default options
  inst.options = {}
  // merge options
  if(options){
    for(var i in options){
      inst.options[i] = options[i]
    }
  }

  inst.init = function(){
    inst.DOMLoaded(function() { 
      // make sure there's a canvas involved
      if(inst.options.canvas){
        if(inst.options.canvas instanceof HTMLCanvasElement){
          inst.canvas = inst.options.canvas
        }else if(Object.prototype.toString.call(inst.options.canvas) === '[object Object]'){
          var c = inst.options.canvas
          inst.canvas = document.createElement('canvas')
          inst.canvas.width = c.width;
          inst.canvas.height = c.height;
          if(c.style){ for(var i in c.style){ inst.canvas.style[i] = c.style[i] } }
          document.getElementsByTagName('body')[0].appendChild(inst.canvas)
        }else{
          inst.canvas = document.querySelector(inst.options.canvas)
        }
      }else{
        inst.canvas = document.createElement('canvas')
        inst.canvas.width = 512;
        inst.canvas.height = 512;
        document.getElementsByTagName('body')[0].appendChild(inst.canvas)
      }
      inst.canvas.setAttribute('crossOrigin','anonymous');
      
      // init program
      inst.initProgram();

      // default: unit 0 texture is always the same size as canvas
      inst.gl.uniform2f(inst.textureSizeLocation, inst.canvas.width, inst.canvas.height);

      // set framebuffer (null is for canvas)
      inst.setFramebuffer(null, inst.canvas.width, inst.canvas.height);

      // make sure all images are loaded before calling this
      if(inst.options.loaded){
        var names = [], vl;
        for(var i in inst.options.uniforms){
          vl = inst.options.uniforms[i].val
          if(vl instanceof HTMLImageElement || typeof vl == 'string'){
            names.push(i)
          }
        }
        if(names.length > 0){
          inst.didAllTexturesLoad(names, inst.options.loaded)
        }else{
          inst.options.loaded.call(inst)
        }
      }
    });
  }

  inst.DOMLoaded = function(cb){
    if (document.readyState === "complete" || document.readyState === "loaded") {
     // document is already ready to go
     cb()
    }else{
      document.addEventListener("DOMContentLoaded", function(event) { 
        cb()
      }, {once:true})
    }
  }
  inst.setUniform = function(name, val, cb, opts){
    if(!inst.uniform){inst.uniform = {}}
    if(Object.prototype.toString.call(cb) === '[object Object]'){
      opts = cb
      cb = null
    }
    if(!cb){cb = function(){}}
    if(!opts){opts = {}}
    var forceArray = opts.forceArray;
    if(opts.isArray){ forceArray = opts.isArray}
    var gl = inst.gl, program = inst.program, shaderUpdate = false;

    if(!isNaN(val)){
      opts.type = opts.type?opts.type:'float'
      if(!inst.uniform[name]){
        inst.uniform[name] = {
          location:gl.getUniformLocation(program, name),
          type:opts.type
        }
        shaderUpdate = true
      }
      inst.uniform[name].val = val
      switch(opts.type){
        case 'float':
          gl.uniform1f(inst.uniform[name].location, parseFloat(val));
        break;
        case 'int':
          gl.uniform1i(inst.uniform[name].location, parseInt(val));
        break;
        default:
          throw new Error("Unsupported uniform type")
      }
      cb(inst.uniform[name], name)
    }else if(Object.prototype.toString.call(val) === '[object Array]'){
      if(!inst.uniform[name]){
        inst.uniform[name] = {
          location:gl.getUniformLocation(program, name)
        }
        shaderUpdate = true
      }
      if(forceArray || val.length > 4){
        gl.uniform1fv(inst.uniform[name].location, val);
        inst.uniform[name].type = 'float'
        inst.uniform[name].length = val.length
        inst.uniform[name].isArray = true
        inst.uniform[name].val = val
      }else if(val.length == 1){
        gl.uniform2f(inst.uniform[name].location, val[0], val[1]);
        inst.uniform[name].type = 'float'
        inst.uniform[name].val = val
      }else if(val.length == 2){
        gl.uniform2f(inst.uniform[name].location, val[0], val[1]);
        inst.uniform[name].type = 'vec2'
        inst.uniform[name].val = val
      }else if(val.length == 3){
        gl.uniform3f(inst.uniform[name].location, parseFloat(val[0]), parseFloat(val[1]), parseFloat(val[2]));
        inst.uniform[name].type = 'vec3'
        inst.uniform[name].val = val
      }else if(val.length == 4){
        gl.uniform4f(inst.uniform[name].location, parseFloat(val[0]), parseFloat(val[1]), parseFloat(val[2]), parseFloat(val[3]));
        inst.uniform[name].type = 'vec4'
        inst.uniform[name].val = val
      }else{
        throw new Error('setUniform: Uniform value must not be empty array')
      }
      cb(inst.uniform[name], name)
    }else if(val instanceof HTMLImageElement || typeof val == 'string'){
      if(!inst.uniform[name]){
        inst.uniform[name] = {
          location:inst.createAndSetupTexture(gl),
          type:'sampler2D',
          loaded:false
        }

        if(!inst.skipFramebuffers){
          // make a framebuffer
          var fb = gl.createFramebuffer();
          var texture = inst.uniform[name].location

          // make this the current frame buffer
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

          // attach the texture to the framebuffer.
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

          inst.uniform[name].fbo = fb

          // Unbind the framebuffer
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        shaderUpdate = true
      }
      if(typeof val == 'string'){
        var elSel = val;

        function addImgElem(){
          val = document.createElement('img');
          val.id = name
          val.style.display = 'none'
          val.src = elSel //
          document.getElementsByTagName('body')[0].appendChild(val)
        }
        try{
          val = document.querySelector(elSel)
        }catch(err){
          addImgElem()
        }
        if(!(val instanceof HTMLImageElement)){
          //throw new Error('Element with selector '+elSel+' is not HTMLImageElement')
          // must be path then
          addImgElem()
        }
      }
      inst.whenImgLoaded(val, function(img, uniformName){
        var uni = inst.uniform[uniformName]
        uni.width = img.naturalWidth
        uni.height = img.naturalHeight
        gl.bindTexture(gl.TEXTURE_2D, uni.location);
        if(inst.options.floatTextures){
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.FLOAT, img)
        }else{
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
        }
        //inst.setTexture(name, 0)
        uni.loaded = true
        // check if textures are loaded
        inst.didAllTexturesLoad()
        cb(uni, uniformName)
      }, name)
      inst.uniform[name].val = val
    }else if(Object.prototype.toString.call(val) === '[object Object]'){
      // this object contains description for a texture

      var depth = 4 // bc it's always RGBA
      var len = val.pixels?val.pixels.length:1
      var size, padLength = 0;
      if(val.width && val.height){
        size = {width:val.width, height:val.height}
      }else{
        var side = Math.ceil( Math.sqrt( len / depth ) );
        size = {width:side, height:side}
        if(val.pixels){
          // right pad with zeroes to avoid "INVALID_OPERATION: texImage2D: ArrayBufferView not big enough for request"
          var newLen = side * side * depth
          if(newLen > len){
            var padLength = newLen - len
            for(var i=0;i<padLength;i++){
              val.pixels.push(0)
            }
          }
        }
      }

      if(!inst.uniform[name]){
        inst.uniform[name] = {
          location: inst.createAndSetupTexture(gl),
          type:'sampler2D',
          width:size.width,
          height:size.height,
          loaded:true,
          padLength:padLength
        }

        if(!inst.skipFramebuffers){
          // make a framebuffer
          var fb = gl.createFramebuffer();
          var texture = inst.uniform[name].location

          // make this the current frame buffer
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

          // attach the texture to the framebuffer.
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

          inst.uniform[name].fbo = fb

          // Unbind the framebuffer
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

      }
      var uni = inst.uniform[name]

      //var img = val.pixels?new Float32Array(val.pixels):null
      gl.bindTexture(gl.TEXTURE_2D, uni.location);
      if(inst.options.floatTextures){
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, uni.width, uni.height, 0, gl.RGBA, gl.FLOAT, val.pixels?new Float32Array(val.pixels):null);
      }else{
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, uni.width, uni.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, val.pixels?new Uint8Array(val.pixels):null);
      }
      // check if textures are loaded
      inst.didAllTexturesLoad()
      cb(uni, name)
    }else{
      throw new Error('setUniform: Uniform value must be a number or array of numbers')
    }
    if(shaderUpdate){
      inst.shaderChanged = true
    }
    return shaderUpdate;
  }

  inst.readPixels = function(left, top, width, height, name){
    var gl = inst.gl;

    if(name){
      // bind the framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, inst.uniform[name].fbo);
    }

    if(inst.options.floatTextures){
      var pixels = new Float32Array(width * height * 4); 
      gl.readPixels(left, top, width, height, gl.RGBA, gl.FLOAT, pixels);
    }else{
      var pixels = new Uint8Array(width * height * 4);
      gl.readPixels(left, top, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    }

    if(name){
      // Unbind the framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    return pixels
  }

  inst.recompile = function(){
    inst.updateShader(inst.uniform)
    inst.recompileShader(inst.fragmentShader, inst.gl.FRAGMENT_SHADER);
  }

  inst.didAllTexturesLoad = function(names, cb){
    var unis = inst.uniform, allLoaded = true;
    if(inst.skipLoaded){return;}
    if(!inst.loads){inst.loads = {}}
    if(typeof names == 'function'){
      cb = names
      names = null;
    }
    var allNames = [], loaded = []
    if(unis){
      for(var i in unis){
        if(unis[i].type == 'sampler2D' && !unis[i].loaded){
          if(names && names.indexOf(i) != -1){
            allLoaded = false;
          }else{
            allLoaded = false;
          }
        }else{
          loaded.push(i)
        }
        allNames.push(i)
      }
    }
    if(names && cb){
      inst.loads[names.join('|')] = cb;
    }else if(cb){
      inst.loads[allNames.join('|')] = cb;
    }
    // trigger all loaded
    for(var i in inst.loads){
      var arr = i.split('|'), isLd = true;
      for(var j in arr){
        if(loaded.indexOf(arr[j]) === -1){
          isLd = false;
          break;
        }
      }
      if(isLd){
        inst.loads[i].call(inst)
        inst.loads[i] = function(){}
        delete inst.loads[i];
      }
    }
    return allLoaded
  }

  inst.updateShader = function(uniforms, shaderSource){
    if(!uniforms){return}
    for(var name in uniforms){
      if(name == 'u_image'){continue;}
      var vl = uniforms[name];
      var inf = inst.infoFromValue(vl.val, vl.isArray);
      var typ = inf.type
      var len = inf.length
      var upd = 'uniform '+typ+' '+name+(len?'['+len+']':'')+";"
      if(shaderSource){
        inst.fragmentShader = shaderSource;
      }
      if(inst.fragmentShader.indexOf(upd) == -1){
        inst.fragmentShader = inst.fragmentShader.replace('/*_uniforms*/', 'uniform '+typ+' '+name+(len?'['+len+']':'')+"; \n    /*_uniforms*/")
      }
    }
    return inst.fragmentShader;
  }

  /* from http://robertpenner.com/easing/
    @t is the current time (or position) of the tween. This can be seconds or frames, steps, seconds, ms, whatever – as long as the unit is the same as is used for the total time [3].
    @b is the beginning value of the property.
    @c is the change between the beginning and destination value of the property.
    @d is the total time of the tween.
  */
  inst.ease = function(type){
    if(type == 'out_elastic'){
      return function(t, b, c, d) {
        var ts=(t/=d)*t;
        var tc=ts*t;
        return b+c*(44.6925*tc*ts + -132.63*ts*ts + 144.48*tc + -69.59*ts + 14.0475*t);
      }
    }else if(type == 'out_cubic'){
      return function(t, b, c, d) {
        var ts=(t/=d)*t;
        var tc=ts*t;
        return b+c*(1.77635683940025e-15*tc*ts + 0.999999999999998*tc + -3*ts + 3*t);
      }
    }else if(type == 'out_quartic'){
      return function(t, b, c, d) {
        var ts=(t/=d)*t;
        var tc=ts*t;
        return b+c*(-1*ts*ts + 4*tc + -6*ts + 4*t);
      }
    }
  }

  inst.whenImgLoaded = function(img, cb, passTrough){
    if(img.complete || img.naturalHeight !== 0){
      cb(img, passTrough)
    }else{
      img.addEventListener('load', function(){
        cb(img, passTrough)
      }, {once:true})
      img.addEventListener('error', function(){
        throw new Error('Image '+img.src+' not found.')
      }, {once:true})
    }
  }

  inst.initProgram = function(){
    var inst = this;
    // Get A WebGL context
    var canvas = inst.canvas;
    var gl = inst.getWebGLContext(canvas);
    inst.gl = gl;
    if (!gl) {return;}

    if(inst.options.floatTextures){
      gl.getExtension('OES_texture_float');
      gl.getExtension('OES_texture_float_linear');
      gl.getExtension("WEBGL_color_buffer_float");
    }

    // couple of default shaders
    inst.vertexShader = "attribute vec2 a_position; \n\
    attribute vec2 a_texCoord; \n\
    uniform vec2 u_resolution; \n\
    uniform float u_flipY; \n\
    varying vec2 v_texCoord; \n\
    void main() { \n\
       vec2 zeroToOne = a_position / u_resolution; \n\
       vec2 zeroToTwo = zeroToOne * 2.0; \n\
       vec2 clipSpace = zeroToTwo - 1.0; \n\
       gl_Position = vec4(clipSpace * vec2(1, u_flipY), 0, 1); \n\
       v_texCoord = a_texCoord; \n\
    }";
    if(inst.options.vertexShader){
      inst.vertexShader = inst.options.vertexShader;
    }

    inst.fragmentShader = "precision mediump float; \n\
    uniform sampler2D u_image; \n\
    uniform vec2 u_textureSize; \n\
    varying vec2 v_texCoord; \n\
    /*_uniforms*/ \n\
    void main() { \n\
      gl_FragColor = texture2D(u_image, v_texCoord); \n\
    }";
    if(inst.options.fragmentShader){
      inst.fragmentShader = inst.options.fragmentShader;
    }

    var program = inst.createProgram()
    inst.program = program;
    gl.useProgram(program);

    // look up where the vertex data needs to go.
    var positionLocation = gl.getAttribLocation(program, "a_position");
    var texCoordLocation = gl.getAttribLocation(program, "a_texCoord");

    // provide texture coordinates for the rectangle.
    var texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0.0,  0.0,
        1.0,  0.0,
        0.0,  1.0,
        0.0,  1.0,
        1.0,  0.0,
        1.0,  1.0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // lookup uniforms
    var resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    inst.resolutionLocation = resolutionLocation;
    var textureSizeLocation = gl.getUniformLocation(program, "u_textureSize");
    inst.textureSizeLocation = textureSizeLocation;

    var flipYLocation = gl.getUniformLocation(program, "u_flipY");
    inst.flipYLocation = flipYLocation;

    // set custom uniforms
    if(inst.options.uniforms){
      for(var name in inst.options.uniforms){
        var vl = inst.options.uniforms[name];
        inst.setUniform(name, vl.val, vl)
      }
    }

    // Create a buffer for the position of the rectangle corners.
    var positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // flip is -1 for canvas 1 for framebuffer
    gl.uniform1f(inst.flipYLocation, -1);

  }

  inst.createAndSetupTexture = function(gl) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Set up texture so we can render any size image and so we are
    // working with pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return texture;
  }

  inst.setRectangle = function(gl, x, y, width, height) {
    var x1 = x;
    var x2 = x + width;
    var y1 = y;
    var y2 = y + height;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
       x1, y1,
       x2, y1,
       x1, y2,
       x1, y2,
       x2, y1,
       x2, y2]), gl.STATIC_DRAW);
  }

  inst.setFramebuffer = function(fbo, width, height) {
    var gl = inst.gl;

    if(fbo){
      gl.uniform1f(this.flipYLocation, 1);
    }else{
      gl.uniform1f(this.flipYLocation, -1);
    }

    // make this the framebuffer we are rendering to.
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    // Tell the shader the resolution of the framebuffer.
    gl.uniform2f(inst.resolutionLocation, width, height);

    // Tell webgl the viewport setting needed for framebuffer.
    gl.viewport(0, 0, width, height);
  }

  inst.draw = function(){
    var gl = inst.gl;

    if(inst.compiled && inst.shaderChanged){
      //inst.recompile()
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  inst.loadShader = function(gl, shaderSource, shaderType) { 
    // Create the shader object
    var shader = gl.createShader(shaderType);

    if(!inst.shaderPointer){inst.shaderPointer = {}}
    inst.shaderPointer[shaderType] = shader;

    // Load the shader source
    gl.shaderSource(shader, shaderSource);

    // Compile the shader
    gl.compileShader(shader);

    // Check the compile status
    var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
      // Something went wrong during compilation; get the error
      var lastError = gl.getShaderInfoLog(shader);
      console.log("*** Error compiling shader '" + shader + "':" + lastError);
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  inst.infoFromValue = function(val, forceArray){
    if(!isNaN(val)){
      return {type:'float'}
    }else if(Object.prototype.toString.call(val) === '[object Array]'){
      if(forceArray || val.length > 4){
        return {type:'float', length:val.length}
      }else if(val.length == 1){
        return {type:'float'}
      }else{
        return {type:'vec'+val.length};
      }
    }else if(val instanceof HTMLImageElement || typeof val == 'string' || Object.prototype.toString.call(val) === '[object Object]'){
      return {type:'sampler2D'};
    }
  }

  inst.createProgram = function(){

    var gl = inst.gl;
    var program = gl.createProgram();
    inst.program = program;

    // update shader with uniforms
    inst.updateShader(inst.options.uniforms)
    
    gl.attachShader(program, inst.loadShader(gl, inst.vertexShader, gl.VERTEX_SHADER));
    gl.attachShader(program, inst.loadShader(gl, inst.fragmentShader, gl.FRAGMENT_SHADER));
    
    gl.linkProgram(program);

    // Check the link status
    var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
        // something went wrong with the link
        var lastError = gl.getProgramInfoLog(program);
        console.log("Error in program linking:" + lastError);

        gl.deleteProgram(program);
        return null;
    }
    inst.compiled = true;
    return program;
  }

  inst.recompileShader = function(shaderSource, shaderType){
    return;
    var gl = inst.gl, program = inst.program;
    //gl.deleteShader(program, inst.shaderPointer[shaderType])
    gl.detachShader(program, inst.shaderPointer[shaderType])
    
    gl.attachShader(program, inst.loadShader(gl, shaderSource, shaderType));
    gl.linkProgram(program);

    // Check the link status
    var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
        inst.compiled = false;
        // something went wrong with the link
        var lastError = gl.getProgramInfoLog(program);
        console.log("Error in program linking:" + lastError);

        gl.deleteProgram(program);
        return null;
    }

    gl.useProgram(program)

    inst.compiled = true;
  }

  inst.getWebGLContext = function(canvas, opt_attribs){
    var names = ["experimental-webgl2", "webgl", "experimental-webgl"];
    var context = null;
    for (var ii = 0; ii < names.length; ++ii) {
      try {
        if(opt_attribs){
          opt_attribs.preserveDrawingBuffer = true;
        }else{
          opt_attribs = {preserveDrawingBuffer:true};
        }
        context = canvas.getContext(names[ii], opt_attribs);
      } catch(e) {}  // eslint-disable-line
      if (context) {
        break;
      }
    }
    return context;
  }

  inst.setTexture = function(name, unitId){
    var gl = inst.gl;

    if(!inst.texUnit){inst.texUnit = 1}
    var uniform = inst.uniform[name];
    if(!uniform){
      throw new Error('Uniform '+name+' does not exist')
    }
    if(uniform.type != 'sampler2D'){
      throw new Error('Uniform '+name+' type must be sampler2D and not '+uniform.type)
    }
    if(unitId === null && uniform.unitId){
      unitId = uniform.unitId;
    }else if(unitId === null){
      unitId = inst.texUnit; 
      inst.texUnit += 1;
    }
    uniform.unitId = unitId;


    if(!uniform.unitLocation){
      uniform.unitLocation = gl.getUniformLocation(inst.program, name);
    }

    // set which texture units to render with.
    gl.uniform1i(uniform.unitLocation, unitId);  // texture unit

    // Set each texture unit to use a particular texture.
    gl.activeTexture(gl.TEXTURE0 + unitId);
    gl.bindTexture(gl.TEXTURE_2D, uniform.location);

    //gl.activeTexture(gl.TEXTURE0);
  }

  inst.clear = function(){
    inst.gl.clear(inst.gl.DEPTH_BUFFER_BIT | inst.gl.COLOR_BUFFER_BIT);
  }

  // start up
  inst.init();
  
}