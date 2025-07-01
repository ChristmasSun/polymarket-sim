import { Portfolio } from '@/types/polymarket';
import { TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react';

interface PortfolioSummaryProps {
  portfolio: Portfolio;
  onReset: () => void;
}

export default function PortfolioSummary({ portfolio, onReset }: PortfolioSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  const totalValue = portfolio.current_balance + portfolio.current_portfolio_value;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Portfolio Summary</h2>
        <button
          onClick={onReset}
          className="btn-secondary text-sm"
        >
          Reset Portfolio
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-600">Available Cash</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(portfolio.current_balance)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-xl p-4">
          <div className="flex items-center">
            <PieChart className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-purple-600">Portfolio Value</p>
              <p className="text-2xl font-bold text-purple-900">
                {formatCurrency(portfolio.current_portfolio_value)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-600">Total Value</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(totalValue)}
              </p>
            </div>
          </div>
        </div>

        <div className={`${
          portfolio.total_profit_loss >= 0 ? 'bg-green-50' : 'bg-red-50'
        } rounded-xl p-4`}>
          <div className="flex items-center">
            {portfolio.total_profit_loss >= 0 ? (
              <TrendingUp className="h-8 w-8 text-green-600" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-600" />
            )}
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                portfolio.total_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                Total P&L
              </p>
              <p className={`text-2xl font-bold ${
                portfolio.total_profit_loss >= 0 ? 'text-green-900' : 'text-red-900'
              }`}>
                {formatCurrency(portfolio.total_profit_loss)}
              </p>
              <p className={`text-sm ${
                portfolio.total_profit_loss >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {formatPercentage(portfolio.total_profit_loss_percentage)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-600">Starting Balance</p>
          <p className="font-semibold text-gray-900">
            {formatCurrency(portfolio.starting_balance)}
          </p>
        </div>
        <div>
          <p className="text-gray-600">Total Invested</p>
          <p className="font-semibold text-gray-900">
            {formatCurrency(portfolio.total_invested)}
          </p>
        </div>
        <div>
          <p className="text-gray-600">Active Positions</p>
          <p className="font-semibold text-gray-900">
            {portfolio.positions.length}
          </p>
        </div>
      </div>
    </div>
  );
} 