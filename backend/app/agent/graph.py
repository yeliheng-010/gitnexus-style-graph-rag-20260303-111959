from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.agent.nodes import AgentNodes
from app.agent.state import GraphState


class GraphAgent:
    def __init__(self, nodes: AgentNodes) -> None:
        self.nodes = nodes
        self.app = self._build_graph()

    def _build_graph(self):
        graph = StateGraph(GraphState)
        graph.add_node("router", self.nodes.router_node)
        graph.add_node("symbol_suggest_tool", self.nodes.symbol_suggest_node)
        graph.add_node("retrieve_tool", self.nodes.retrieve_node)
        graph.add_node("expand_graph_tool", self.nodes.expand_graph_node)
        graph.add_node("call_path_tool", self.nodes.call_path_node)
        graph.add_node("answer_node", self.nodes.answer_node)
        graph.add_node("verify", self.nodes.verify_node)

        graph.add_edge(START, "router")
        graph.add_conditional_edges(
            "router",
            self._route_selector,
            {
                "direct_answer": "answer_node",
                "RAG": "retrieve_tool",
                "GraphRAG": "retrieve_tool",
                "CallPath": "call_path_tool",
                "NeedDisambiguation": "symbol_suggest_tool",
            },
        )

        graph.add_conditional_edges(
            "retrieve_tool",
            self._after_retrieve_selector,
            {
                "expand_graph_tool": "expand_graph_tool",
                "answer": "answer_node",
            },
        )
        graph.add_edge("expand_graph_tool", "answer_node")
        graph.add_edge("call_path_tool", "answer_node")
        graph.add_edge("symbol_suggest_tool", "answer_node")
        graph.add_edge("answer_node", "verify")
        graph.add_conditional_edges(
            "verify",
            self._verify_selector,
            {
                "retry_retrieve": "retrieve_tool",
                "retry_path": "call_path_tool",
                "end": END,
            },
        )

        return graph.compile()

    @staticmethod
    def _route_selector(state: GraphState) -> str:
        return str(state.get("route", "RAG"))

    @staticmethod
    def _after_retrieve_selector(state: GraphState) -> str:
        route = state.get("route")
        if route == "GraphRAG":
            return "expand_graph_tool"
        return "answer"

    @staticmethod
    def _verify_selector(state: GraphState) -> str:
        if state.get("needs_retry"):
            if state.get("route") == "CallPath":
                return "retry_path"
            return "retry_retrieve"
        return "end"

    def run(self, state: GraphState) -> GraphState:
        if "trace" not in state:
            state["trace"] = {"nodes": []}
        if "attempts" not in state:
            state["attempts"] = 0
        return self.app.invoke(state)
