import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Search, Plus, Edit, Eye, DollarSign } from "lucide-react";
import { api, type Product } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Catalog() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: searchResults } = useQuery<Product[]>({
    queryKey: ['/api/products/search', searchQuery],
    enabled: searchQuery.length > 0,
    queryFn: () => api.searchProducts(searchQuery),
  });

  const displayProducts = searchQuery ? searchResults : products;

  if (isLoading) {
    return (
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Product Catalog</h2>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="w-full h-48 bg-muted rounded-lg"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  const totalProducts = products?.length || 0;
  const inStockProducts = products?.filter(p => p.inStock).length || 0;
  const outOfStockProducts = totalProducts - inStockProducts;

  return (
    <main className="flex-1 ml-64 p-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-foreground">Product Catalog</h2>
          <Button data-testid="button-add-product">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
        <p className="text-muted-foreground">Manage your product inventory and pricing</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-xl font-bold text-foreground">{totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">In Stock</p>
                <p className="text-xl font-bold text-foreground">{inStockProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-xl font-bold text-foreground">{outOfStockProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name, category, or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-products"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayProducts?.length ? displayProducts.map((product) => (
          <Card key={product.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              {product.photoUrl ? (
                <img
                  src={product.photoUrl}
                  alt={product.name}
                  className="w-full h-48 object-cover rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`w-full h-48 bg-muted rounded-lg flex items-center justify-center ${product.photoUrl ? 'hidden' : ''}`}>
                <Package className="w-12 h-12 text-muted-foreground" />
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="mb-3">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    {product.name}
                  </h3>
                  <Badge variant={product.inStock ? "default" : "destructive"} className="ml-2 text-xs">
                    {product.inStock ? "In Stock" : "Out of Stock"}
                  </Badge>
                </div>
                
                {product.category && (
                  <p className="text-xs text-muted-foreground mb-2">{product.category}</p>
                )}
                
                <div className="flex items-center space-x-2 mb-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-lg font-bold text-foreground">
                    {product.price} {product.currency}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  SKU: {product.sku}
                </p>
              </div>
              
              <div className="flex space-x-2">
                <Button size="sm" variant="outline" className="flex-1" data-testid={`button-view-${product.id}`}>
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>
                <Button size="sm" variant="outline" className="flex-1" data-testid={`button-edit-${product.id}`}>
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {searchQuery ? 'No products found' : 'No products yet'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery 
                    ? 'Try adjusting your search criteria.'
                    : 'Start building your catalog by adding your first product.'
                  }
                </p>
                {!searchQuery && (
                  <Button data-testid="button-add-first-product">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Product
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
