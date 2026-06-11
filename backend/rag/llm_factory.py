"""
LLM factory: returns the correct LangChain chat model based on config.
Supports OpenAI, Groq, Anthropic, and Ollama.
"""
from langchain_core.language_models import BaseChatModel
from config import settings


def get_llm(temperature: float = 0.0) -> BaseChatModel:
    provider = settings.LLM_PROVIDER.lower()

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=settings.LLM_MODEL,
            temperature=temperature,
            api_key=settings.OPENAI_API_KEY,
        )

    elif provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=settings.LLM_MODEL,
            temperature=temperature,
            api_key=settings.GROQ_API_KEY,
        )

    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=settings.LLM_MODEL,
            temperature=temperature,
            api_key=settings.ANTHROPIC_API_KEY,
        )

    elif provider == "ollama":
        from langchain_community.chat_models import ChatOllama
        return ChatOllama(
            model=settings.LLM_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=temperature,
        )

    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider!r}. Choose from: openai, groq, anthropic, ollama")


def get_embeddings():
    """Return an embedding model based on EMBEDDING_PROVIDER setting."""
    provider = settings.EMBEDDING_PROVIDER.lower()

    if provider == "openai":
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(api_key=settings.OPENAI_API_KEY)

    elif provider == "sentence-transformers":
        from langchain_community.embeddings import SentenceTransformerEmbeddings
        return SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")

    else:
        raise ValueError(f"Unknown EMBEDDING_PROVIDER: {provider!r}")
