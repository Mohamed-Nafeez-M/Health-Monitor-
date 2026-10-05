import { jsx, jsxs } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter
} from "wouter";
const queryClient = new QueryClient();
function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    /* @__PURE__ */ jsx(RoutedErrorBoundary, { children: /* @__PURE__ */ jsxs(Switch, { children: [
      /* @__PURE__ */ jsx(Route, { path: "/", component: Dashboard }),
      /* @__PURE__ */ jsx(Route, { component: NotFound })
    ] }) })
  );
}
function RoutedErrorBoundary({ children }) {
  const [location] = useLocation();
  return /* @__PURE__ */ jsx(ErrorBoundary, { resetKey: location, children });
}
function App() {
  return /* @__PURE__ */ jsx(QueryClientProvider, { client: queryClient, children: /* @__PURE__ */ jsxs(TooltipProvider, { children: [
    /* @__PURE__ */ jsx(WouterRouter, { base: import.meta.env.BASE_URL.replace(/\/$/, ""), children: /* @__PURE__ */ jsx(Router, {}) }),
    /* @__PURE__ */ jsx(Toaster, {})
  ] }) });
}
var App_default = App;
export {
  App_default as default
};
