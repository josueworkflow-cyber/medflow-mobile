import { api } from "./client";
import { Produto } from "../types/produto";

const mapProduto = (p: any): Produto => {
  if (!p) return p;
  return {
    ...p,
    nome: p.descricao || p.nome || "",
    unidade: p.unidadeVenda || p.unidade || "UN",
  };
};

export const ProdutosAPI = {
  async buscarPorCodigoBarras(codigoBarras: string): Promise<Produto | null> {
    const response = await api.get<{ items: any[] }>("/api/produto", {
      params: { search: codigoBarras },
    });
    const items = response.data.items || [];
    if (items.length === 0) return null;
    return mapProduto(items[0]);
  },

  async buscarPorTexto(texto: string): Promise<Produto[]> {
    const response = await api.get<{ items: any[] }>("/api/produto", {
      params: { search: texto },
    });
    const items = response.data.items || [];
    return items.map(mapProduto);
  },

  async criar(payload: any): Promise<Produto> {
    const response = await api.post<any>("/api/produto", payload);
    return mapProduto(response.data);
  },

  async buscarCategorias(): Promise<{ flat: { id: number; nome: string }[] }> {
    const response = await api.get("/api/produto/categoria");
    return response.data;
  },
};
