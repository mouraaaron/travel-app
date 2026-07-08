import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TripSearchForm } from "@/components/trip/trip-search-form";

export default function SearchPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Buscar viagem</CardTitle>
      </CardHeader>
      <CardContent>
        <TripSearchForm />
      </CardContent>
    </Card>
  );
}
