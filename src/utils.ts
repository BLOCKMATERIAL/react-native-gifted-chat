import React, { useCallback, useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import { IMessage } from './Models'

export function renderComponentOrElement<TProps extends Record<string, any>>(
  component: React.ComponentType<TProps> | React.ReactElement | ((props: TProps) => React.ReactNode) | null | undefined,
  props: TProps
): React.ReactNode {
  if (!component)
    return null

  if (React.isValidElement(component))
    // If it's already a React element, clone it with props
    return React.cloneElement(component, props as any)

  if (typeof component === 'function') {
    // If it's a component or render function
    const Component = component as React.ComponentType<TProps>
    return React.createElement(Component, props as any)
  }

  // If it's neither, return it as-is
  return component
}

export function isSameDay (
  currentMessage: IMessage,
  diffMessage: IMessage | null | undefined
) {
  if (!diffMessage || !diffMessage.createdAt)
    return false

  const currentCreatedAt = dayjs(currentMessage.createdAt)
  const diffCreatedAt = dayjs(diffMessage.createdAt)

  if (!currentCreatedAt.isValid() || !diffCreatedAt.isValid())
    return false

  return currentCreatedAt.isSame(diffCreatedAt, 'day')
}

export function isSameUser (
  currentMessage: IMessage,
  diffMessage: IMessage | null | undefined
) {
  return !!(
    diffMessage &&
    diffMessage.user &&
    currentMessage.user &&
    diffMessage.user._id === currentMessage.user._id
  )
}

function processCallbackArguments (args: unknown[]): unknown[] {
  const [e, ...rest] = args
  const { nativeEvent } = (e as { nativeEvent?: unknown }) || {}
  let params: unknown[] = []
  if (e) {
    if (nativeEvent)
      params.push({ nativeEvent })
    else
      params.push(e)
    if (rest)
      params = params.concat(rest)
  }

  return params
}

export function useCallbackDebounced<T extends (...args: any[]) => any>(callbackFunc: T, deps: React.DependencyList = [], time: number): (...args: Parameters<T>) => void {
  const timeoutId = useRef<ReturnType<typeof setTimeout>>(undefined)

  const savedFunc = useCallback((...args: Parameters<T>) => {
    const params = processCallbackArguments(args)
    if (timeoutId.current)
      clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => {
      callbackFunc(...params as Parameters<T>)
    }, time)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackFunc, time, ...deps])

  useEffect(() => {
    return () => {
      if (timeoutId.current)
        clearTimeout(timeoutId.current)
    }
  }, [])

  return savedFunc
}

export function useCallbackThrottled<T extends (...args: any[]) => any>(callbackFunc: T, deps: React.DependencyList = [], time: number): (...args: Parameters<T>) => void {
  const lastExecution = useRef<number>(0)
  const timeoutId = useRef<ReturnType<typeof setTimeout>>(undefined)

  // we use function instead of arrow to access arguments object
  const savedFunc = useCallback((...args: Parameters<T>) => {
    const params = processCallbackArguments(args)

    const now = Date.now()
    const timeSinceLastExecution = now - lastExecution.current

    if (timeSinceLastExecution >= time) {
      // Execute immediately if enough time has passed
      lastExecution.current = now
      callbackFunc(...params as Parameters<T>)
    } else {
      // Schedule execution for the remaining time
      clearTimeout(timeoutId.current)
      timeoutId.current = setTimeout(() => {
        lastExecution.current = Date.now()
        callbackFunc(...params as Parameters<T>)
      }, time - timeSinceLastExecution)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackFunc, time, ...deps])

  useEffect(() => {
    return () => {
      clearTimeout(timeoutId.current)
    }
  }, [])

  return savedFunc
}

/**
 * Safely convert createdAt to a valid Date or number
 * Handles Date, number (timestamp), and Dayjs objects
 * Prevents "Objects are not valid as a React child" error
 */
export function normalizeCreatedAt(createdAt: any): Date | number | null {
  if (createdAt == null)
    return null

  // If it's already a Date, return it
  if (createdAt instanceof Date)
    return createdAt

  // If it's a number (timestamp), return it
  if (typeof createdAt === 'number')
    return createdAt

  // If it's a Dayjs object with $isDayjsObject property, convert to Date
  if (typeof createdAt === 'object' && createdAt.$isDayjsObject === true) {
    const asDate = createdAt.toDate()
    return asDate instanceof Date ? asDate : null
  }

  // If it's a string, try to parse as number (timestamp)
  if (typeof createdAt === 'string') {
    const parsed = Number.parseInt(createdAt, 10)
    return !Number.isNaN(parsed) ? parsed : null
  }

  // Try to convert using dayjs as fallback
  try {
    const dayjsObj = dayjs(createdAt)
    if (dayjsObj.isValid())
      return dayjsObj.toDate()
  } catch {
    // Ignore errors
  }

  return null
}
