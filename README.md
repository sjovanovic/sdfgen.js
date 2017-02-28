# sdfgen.js
Applies Signed Distance Field (SDF) algorithm to the input image in the browser via WebGL 


## How it works

Script translates input image like this:

![Alt text](example/input.png?raw=true "Input image")

into this:

![Alt text](example/result.png?raw=true "Result image")

## Usage

First include the `sdfgen.js` (there are no dependencies) and then

```
new SDFGen({
	inputImage:'input.png', 	// input image
	canvas:'#canvas', 			// output goes to canvas
	spread: 60 					// distance spread amount, default 10
})
```