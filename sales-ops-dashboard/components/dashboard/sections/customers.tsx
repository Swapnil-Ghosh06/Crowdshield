"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Building2,
  Search,
  Plus,
  MapPin,
  Mail,
  Phone,
  DollarSign,
  Calendar,
  ExternalLink,
  Star,
  TrendingUp,
  TrendingDown,
  Filter,
} from "lucide-react";

const customers = [
  {
    id: 1,
    name: "Acme Corporation",
    industry: "Technology",
    tier: "Enterprise",
    location: "San Francisco, CA",
    contact: "John Smith",
    email: "john@acme.com",
    phone: "+1 (555) 123-4567",
    totalRevenue: 485000,
    activeDeals: 3,
    healthScore: 92,
    trend: "up",
    lastContact: "2 days ago",
  },
  {
    id: 2,
    name: "GlobalTech Industries",
    industry: "Manufacturing",
    tier: "Enterprise",
    location: "New York, NY",
    contact: "Sarah Johnson",
    email: "sarah@globaltech.com",
    phone: "+1 (555) 234-5678",
    totalRevenue: 320000,
    activeDeals: 2,
    healthScore: 85,
    trend: "up",
    lastContact: "1 week ago",
  },
  {
    id: 3,
    name: "Innovate Labs",
    industry: "Healthcare",
    tier: "Growth",
    location: "Boston, MA",
    contact: "Michael Chen",
    email: "michael@innovatelabs.com",
    phone: "+1 (555) 345-6789",
    totalRevenue: 156000,
    activeDeals: 1,
    healthScore: 78,
    trend: "stable",
    lastContact: "3 days ago",
  },
  {
    id: 4,
    name: "DataStream Analytics",
    industry: "Data Services",
    tier: "Growth",
    location: "Austin, TX",
    contact: "Emily Rodriguez",
    email: "emily@datastream.com",
    phone: "+1 (555) 456-7890",
    totalRevenue: 98000,
    activeDeals: 2,
    healthScore: 65,
    trend: "down",
    lastContact: "2 weeks ago",
  },
  {
    id: 5,
    name: "NextGen Solutions",
    industry: "Finance",
    tier: "Starter",
    location: "Chicago, IL",
    contact: "David Park",
    email: "david@nextgen.com",
    phone: "+1 (555) 567-8901",
    totalRevenue: 45000,
    activeDeals: 1,
    healthScore: 88,
    trend: "up",
    lastContact: "Yesterday",
  },
  {
    id: 6,
    name: "CloudFirst Inc",
    industry: "Cloud Services",
    tier: "Enterprise",
    location: "Seattle, WA",
    contact: "Lisa Wang",
    email: "lisa@cloudfirst.com",
    phone: "+1 (555) 678-9012",
    totalRevenue: 275000,
    activeDeals: 4,
    healthScore: 95,
    trend: "up",
    lastContact: "Today",
  },
];

const tierColors: Record<string, string> = {
  Enterprise: "bg-accent/20 text-accent border-accent/30",
  Growth: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  Starter: "bg-muted text-muted-foreground border-border",
};

export function CustomersSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.contact.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = !selectedTier || customer.tier === selectedTier;
    return matchesSearch && matchesTier;
  });

  const totalRevenue = customers.reduce((acc, c) => acc + c.totalRevenue, 0);
  const avgHealthScore = Math.round(
    customers.reduce((acc, c) => acc + c.healthScore, 0) / customers.length
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Customers",
            value: customers.length.toString(),
            icon: Building2,
            color: "text-foreground",
          },
          {
            label: "Total Revenue",
            value: `$${(totalRevenue / 1000000).toFixed(2)}M`,
            icon: DollarSign,
            color: "text-accent",
          },
          {
            label: "Avg Health Score",
            value: `${avgHealthScore}%`,
            icon: Star,
            color: "text-chart-3",
          },
          {
            label: "Active Deals",
            value: customers.reduce((acc, c) => acc + c.activeDeals, 0).toString(),
            icon: TrendingUp,
            color: "text-chart-1",
          },
        ].map((stat, index) => (
          <Card
            key={stat.label}
            className="border-border bg-card hover:border-muted-foreground/30 transition-all duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>
                    {stat.value}
                  </p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-[280px] bg-secondary border-border focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {["Enterprise", "Growth", "Starter"].map((tier) => (
              <Button
                key={tier}
                variant={selectedTier === tier ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}
                className={selectedTier === tier ? "bg-accent text-accent-foreground" : ""}
              >
                {tier}
              </Button>
            ))}
          </div>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Customer Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredCustomers.map((customer, index) => (
          <Card
            key={customer.id}
            className="border-border bg-card hover:border-accent/50 transition-all duration-300 group animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${index * 75}ms` }}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 bg-secondary">
                    <AvatarFallback className="bg-secondary text-foreground font-semibold">
                      {customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                      {customer.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{customer.industry}</p>
                  </div>
                </div>
                <Badge className={`${tierColors[customer.tier]} border`}>
                  {customer.tier}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    {customer.location}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    {customer.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    {customer.phone}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-medium text-foreground">
                      ${customer.totalRevenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Deals</span>
                    <span className="font-medium text-foreground">{customer.activeDeals}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Contact</span>
                    <span className="font-medium text-foreground">{customer.lastContact}</span>
                  </div>
                </div>
              </div>

              {/* Health Score */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Health Score</span>
                  {customer.trend === "up" && (
                    <TrendingUp className="w-3.5 h-3.5 text-accent" />
                  )}
                  {customer.trend === "down" && (
                    <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${customer.healthScore}%`,
                        backgroundColor:
                          customer.healthScore >= 80
                            ? "oklch(0.7 0.18 145)"
                            : customer.healthScore >= 60
                            ? "oklch(0.75 0.18 55)"
                            : "oklch(0.65 0.2 25)",
                      }}
                    />
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      customer.healthScore >= 80
                        ? "text-accent"
                        : customer.healthScore >= 60
                        ? "text-chart-3"
                        : "text-destructive"
                    }`}
                  >
                    {customer.healthScore}%
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                  Schedule
                </Button>
                <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                  <Mail className="w-3.5 h-3.5 mr-1.5" />
                  Email
                </Button>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
