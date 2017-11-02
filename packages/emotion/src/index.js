import { hashString, Stylis, memoize, unitless } from 'emotion-utils'
import stylisRuleSheet from 'stylis-rule-sheet'
import StyleSheet from './sheet'

export const sheet = new StyleSheet()

// 🚀
sheet.inject()
const stylisOptions = { keyframe: false }

if (process.env.NODE_ENV !== 'production') {
  stylisOptions.compress = false
}

let stylis = new Stylis(stylisOptions)

const externalStylisPlugins = []

const use = stylis.use

function insertRule(rule) {
  sheet.insert(rule, currentSourceMap)
}

const insertionPlugin = stylisRuleSheet(insertRule)

export const useStylisPlugin = plugin => {
  externalStylisPlugins.push(plugin)
  use(null)(externalStylisPlugins)(insertionPlugin)
}

export let registered = {}

export let inserted = {}

let currentSourceMap = ''

stylis.use(insertionPlugin)

const cssRegex = /css-[A-Za-z0-9]+-[A-Za-z0-9]+/

function getRegisteredStylesFromInterpolation(interpolation: any) {
  if (typeof interpolation === 'string') {
    const matches = cssRegex.exec(interpolation)
    if (matches != null && matches[0] !== undefined) {
      return registered[matches[0]]
    }
  }

  return registered[interpolation]
}

function handleInterpolation(
  interpolation: any,
  couldBeSelectorInterpolation: boolean
) {
  if (interpolation == null) {
    return ''
  }

  switch (typeof interpolation) {
    case 'boolean':
      return ''
    case 'function':
      return handleInterpolation.call(
        this,
        this === undefined
          ? interpolation()
          : interpolation(this.mergedProps, this.context),
        couldBeSelectorInterpolation
      )
    case 'object':
      return createStringFromObject.call(this, interpolation)
    default:
      const cached = getRegisteredStylesFromInterpolation(interpolation)
      return couldBeSelectorInterpolation === false && cached !== undefined
        ? cached
        : interpolation
  }
}

const hyphenateRegex = /[A-Z]|^ms/g

const processStyleName = memoize(styleName =>
  styleName.replace(hyphenateRegex, '-$&').toLowerCase()
)

const processStyleValue = (key, value) => {
  if (value === undefined || value === null || typeof value === 'boolean')
    return ''

  if (unitless[key] !== 1 && !isNaN(value) && value !== 0) {
    return value + 'px'
  }
  return value
}

const objectToStringCache = new WeakMap()

function createStringFromObject(obj) {
  if (objectToStringCache.has(obj)) {
    return objectToStringCache.get(obj)
  }
  let string = ''

  if (Array.isArray(obj)) {
    obj.forEach(function(interpolation) {
      string += handleInterpolation.call(this, interpolation, false)
    }, this)
  } else {
    Object.keys(obj).forEach(function(key) {
      if (typeof obj[key] !== 'object') {
        if (registered[obj[key]] !== undefined) {
          string += `${key}{${getRegisteredStylesFromInterpolation(obj[key])}}`
        } else {
          string += `${processStyleName(key)}:${processStyleValue(
            key,
            obj[key]
          )};`
        }
      } else {
        string += `${key}{${handleInterpolation.call(this, obj[key], false)}}`
      }
    }, this)
  }
  objectToStringCache.set(obj, string)

  return string
}

function isLastCharDot(string) {
  return string.charCodeAt(string.length - 1) === 46 // .
}

function createStyles(strings, ...interpolations) {
  let stringMode = true
  let styles = ''
  let meta = {}

  if (strings == null || strings.raw === undefined) {
    stringMode = false
    styles = handleInterpolation.call(this, strings, false)
  } else {
    styles = strings[0]
  }

  interpolations.forEach(function(interpolation, i) {
    if (typeof interpolation === 'object' && 'meta' in interpolation) {
      meta = interpolation.meta
      return
    }

    styles += handleInterpolation.call(
      this,
      interpolation,
      isLastCharDot(styles)
    )
    if (stringMode === true && strings[i + 1] !== undefined) {
      styles += strings[i + 1]
    }
  }, this)

  return { styles, meta }
}

if (process.env.NODE_ENV !== 'production') {
  const sourceMapRegEx = /\/\*#\ssourceMappingURL=data:application\/json;\S+\s+\*\//
  const oldStylis = stylis
  stylis = (selector, styles) => {
    const result = sourceMapRegEx.exec(styles)
    currentSourceMap = result ? result[0] : ''
    oldStylis(selector, styles)
    currentSourceMap = ''
  }
}

export function css() {
  const { styles, meta } = createStyles.apply(this, arguments)
  const hash = hashString(styles)
  const selector =
    meta.identifierName !== undefined
      ? `css-${hash}-${meta.identifierName}`
      : `css-${hash}`

  if (getRegisteredStylesFromInterpolation(selector) === undefined) {
    registered[selector] = styles
  }

  if (inserted[hash] === undefined) {
    stylis(`.${selector}`, styles)
    inserted[hash] = true
  }

  return selector
}

export function keyframes() {
  const { styles, meta } = createStyles.apply(this, arguments)
  const hash = hashString(styles)
  const name =
    meta.identifierName !== undefined
      ? `animation-${hash}-${meta.identifierName}`
      : `animation-${hash}`

  if (inserted[hash] === undefined) {
    stylis('', `@keyframes ${name}{${styles}}`)
    inserted[hash] = true
  }
  return name
}

export function injectGlobal() {
  const { styles } = createStyles.apply(this, arguments)
  const hash = hashString(styles)
  if (inserted[hash] === undefined) {
    stylis('', styles)
    inserted[hash] = true
  }
}

export function fontFace(...args) {
  const { styles } = createStyles(...args)
  const hash = hashString(styles)
  if (inserted[hash] === undefined) {
    stylis('', `@font-face{${styles}}`)
    inserted[hash] = true
  }
}

export function getRegisteredStyles(registeredStyles, classNames) {
  let rawClassName = ''

  classNames.split(' ').forEach(className => {
    if (registered[className] !== undefined) {
      registeredStyles.push(className)
    } else {
      rawClassName += `${className} `
    }
  })
  return rawClassName
}

export function merge(className, sourceMap) {
  const registeredStyles = []

  const rawClassName = getRegisteredStyles(registeredStyles, className)

  if (registeredStyles.length < 2) {
    return className
  }
  return rawClassName + css(registeredStyles, sourceMap)
}

function classnames() {
  let len = arguments.length
  let i = 0
  let cls = ''
  for (; i < len; i++) {
    let arg = arguments[i]

    if (arg == null) continue
    let next = (cls && cls + ' ') || cls

    switch (typeof arg) {
      case 'boolean':
        break
      case 'function':
        cls = next + classnames(arg())
        break
      case 'object': {
        if (Array.isArray(arg)) {
          cls = next + classnames.apply(null, arg)
        } else {
          for (const k in arg) {
            if (arg[k]) {
              cls && (cls += ' ')
              cls += k
            }
          }
        }
        break
      }
      default: {
        cls = next + arg
      }
    }
  }
  return cls
}

export function cx(...classNames) {
  return merge(classnames(...classNames))
}

export function hydrate(ids) {
  ids.forEach(id => {
    inserted[id] = true
  })
}

export function flush() {
  sheet.flush()
  inserted = {}
  registered = {}
  sheet.inject()
}
