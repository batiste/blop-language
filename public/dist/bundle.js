/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./public/test.blop.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./public/test.blop.js":
/*!*****************************!*\
  !*** ./public/test.blop.js ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("\nroot = document.body;\n\nHello = {\n  view: (number) =>  {\n     const _uid_100 = []; _uid_100_attrs = {};\n       const _uid_101 = []; _uid_101_attrs = {};\n         _uid_101.push(\"A nice title\");\n        _uid_100.push(m('h1', _uid_101_attrs, _uid_101));\n       [1, 2, 33].forEach((i) =>  {\n         const _uid_102 = []; _uid_102_attrs = {}; _uid_102_attrs['class'] = \"hello\" + i;\n           _uid_102.push(\"Hello \" + i * i);\n          _uid_100.push(m('p', _uid_102_attrs, _uid_102));\n       })\n     return m('div', _uid_100_attrs, _uid_100);\n    const _uid_103 = []; _uid_103_attrs = {};\n      const _uid_104 = []; _uid_104_attrs = {};\n        _uid_104.push(\"A nice title\");\n       _uid_103.push(m('h1', _uid_104_attrs, _uid_104));\n      [1, 2, 33].forEach((i) =>  {\n        const _uid_105 = []; _uid_105_attrs = {}; _uid_105_attrs['class'] = \"hello\" + i;\n          _uid_105.push(\"Hello \" + i * i);\n         _uid_103.push(m('p', _uid_105_attrs, _uid_105));\n      })\n    return m('div', _uid_103_attrs, _uid_103);\n  }\n};\n\nm.mount(root, Hello)\n\n\n//# sourceURL=webpack:///./public/test.blop.js?");

/***/ })

/******/ });