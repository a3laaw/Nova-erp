import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    window.addEventListener("resize", handleResize)
    
    // Call handler right away so state is updated with initial window size
    handleResize()

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize)
  }, []) // Empty array ensures that effect is only run on mount and unmount

  return isMobile
}
