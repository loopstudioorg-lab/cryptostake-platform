import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Shield, Coins, TrendingUp, Lock, Zap, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Coins className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold">CryptoStake</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/pools" className="text-sm text-muted-foreground hover:text-foreground transition">
                Pools
              </Link>
              <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground transition">
                FAQ
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition">
                Terms
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button variant="gradient" asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="hero-gradient absolute inset-0" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-6">
              Stake Your Crypto,{' '}
              <span className="text-gradient">Earn Rewards</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of users earning passive income through our secure, custodial staking platform. 
              Stake ETH, BNB, MATIC and more with competitive APRs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="gradient" asChild>
                <Link href="/register">
                  Start Staking <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/pools">View All Pools</Link>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
            {[
              { label: 'Total Value Locked', value: '$12.5M+' },
              { label: 'Active Stakers', value: '5,000+' },
              { label: 'Rewards Paid', value: '$850K+' },
              { label: 'Supported Assets', value: '15+' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-gradient">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Why Stake With Us?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our platform combines security, simplicity, and competitive yields.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: Shield,
                title: 'Bank-Grade Security',
                description: 'Multi-signature wallets, cold storage, and 24/7 monitoring protect your assets.',
              },
              {
                icon: TrendingUp,
                title: 'Competitive APRs',
                description: 'Earn up to 15% APR on your staked assets with flexible and fixed-term options.',
              },
              {
                icon: Zap,
                title: 'Instant Staking',
                description: 'Deposit and start earning immediately. No minimum lock periods for flexible pools.',
              },
              {
                icon: Lock,
                title: 'Custodial Safety',
                description: 'We handle the complexity of staking. Your assets are secured in our custody.',
              },
              {
                icon: Users,
                title: 'Admin-Reviewed Withdrawals',
                description: 'Every withdrawal is reviewed for security, protecting you from unauthorized access.',
              },
              {
                icon: Coins,
                title: 'Multiple Assets',
                description: 'Stake ETH, BNB, MATIC, and many more tokens across multiple chains.',
              },
            ].map((feature) => (
              <Card key={feature.title} className="bg-card/50 border-border/50">
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-2" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Ready to Start Earning?
            </h2>
            <p className="text-muted-foreground mb-8">
              Create your account in minutes and start staking your crypto assets today.
            </p>
            <Button size="lg" variant="gradient" asChild>
              <Link href="/register">
                Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Risk Disclaimer */}
      <section className="py-8 border-t">
        <div className="container mx-auto px-4">
          <p className="text-xs text-muted-foreground text-center max-w-3xl mx-auto">
            <strong>Risk Disclaimer:</strong> Staking involves risk. Past performance does not guarantee future results. 
            This is a custodial platform - your assets are held in platform-controlled wallets. 
            Withdrawals require admin review. Please read our{' '}
            <Link href="/terms" className="underline">Terms of Service</Link> and{' '}
            <Link href="/risk" className="underline">Risk Disclosure</Link> before using our platform.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                <Coins className="h-4 w-4 text-white" />
              </div>
              <span className="font-display font-bold">CryptoStake</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition">Privacy</Link>
              <Link href="/faq" className="hover:text-foreground transition">FAQ</Link>
              <Link href="/contact" className="hover:text-foreground transition">Contact</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 CryptoStake. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
