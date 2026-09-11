Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :presets, only: [:index, :show, :create, :update] do
        member do
          post :like
        end
      end
      resources :headphones, only: [:index, :show]
      resources :audiograms, only: [:create, :show]
    end
  end

  get '/health', to: proc { [200, { 'Content-Type' => 'application/json' }, [{ status: 'ok', service: 'AuraTune Ruby API' }.to_json]] }
end
