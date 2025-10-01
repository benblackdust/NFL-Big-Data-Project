import React, { useState } from 'react';
import { FileText, TrendingUp, Users, Target, Map, Activity } from 'lucide-react';

const EDAStarterCode = () => {
  const [activeSection, setActiveSection] = useState('data-loading');

  const codeSnippets = {
    'data-loading': `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

# Set style
sns.set_style('whitegrid')
plt.rcParams['figure.figsize'] = (14, 8)

# Load the data
tracking_df = pd.read_csv('tracking_week_1.csv')
plays_df = pd.read_csv('plays.csv')
players_df = pd.read_csv('players.csv')
games_df = pd.read_csv('games.csv')

# Display basic info
print("Tracking Data Shape:", tracking_df.shape)
print("\\nTracking Columns:", tracking_df.columns.tolist())
print("\\nFirst few rows:")
print(tracking_df.head())

# Check for null values
print("\\nNull values:")
print(tracking_df.isnull().sum())

# Merge with play and player info
tracking_with_info = tracking_df.merge(
    plays_df, on=['gameId', 'playId'], how='left'
).merge(
    players_df, on='nflId', how='left'
)

print("\\nMerged data shape:", tracking_with_info.shape)`,

    'play-structure': `# Analyze play structure
def analyze_play(game_id, play_id, tracking_df, plays_df):
    """Analyze a single play"""
    
    # Get play info
    play_info = plays_df[
        (plays_df['gameId'] == game_id) & 
        (plays_df['playId'] == play_id)
    ].iloc[0]
    
    # Get tracking data for this play
    play_tracking = tracking_df[
        (tracking_df['gameId'] == game_id) & 
        (tracking_df['playId'] == play_id)
    ].copy()
    
    # Sort by frame
    play_tracking = play_tracking.sort_values(['nflId', 'frameId'])
    
    # Find the pass forward event (ball release)
    pass_frame = play_tracking[
        play_tracking['event'] == 'pass_forward'
    ]['frameId'].values
    
    if len(pass_frame) > 0:
        pass_frame = pass_frame[0]
        
        # Frames before and after pass
        pre_pass = play_tracking[play_tracking['frameId'] < pass_frame]
        post_pass = play_tracking[play_tracking['frameId'] >= pass_frame]
        
        print(f"Play: {game_id}_{play_id}")
        print(f"Pass released at frame: {pass_frame}")
        print(f"Frames before pass: {pre_pass['frameId'].nunique()}")
        print(f"Frames after pass: {post_pass['frameId'].nunique()}")
        print(f"Players tracked: {play_tracking['nflId'].nunique()}")
        
        return play_tracking, pass_frame, play_info
    
    return None, None, None

# Example usage
sample_game = tracking_df['gameId'].iloc[0]
sample_play = tracking_df['playId'].iloc[0]
play_data, pass_frame, play_info = analyze_play(
    sample_game, sample_play, tracking_df, plays_df
)`,

    'player-roles': `# Identify player roles in each play
def categorize_players(play_tracking, play_info):
    """Categorize players by their role in the play"""
    
    # Get targeted receiver
    targeted_receiver = play_info.get('targetNflId', None)
    
    # Categorize each player
    player_roles = []
    
    for nfl_id in play_tracking['nflId'].unique():
        player_data = play_tracking[play_tracking['nflId'] == nfl_id].iloc[0]
        
        role = {
            'nflId': nfl_id,
            'club': player_data['club'],
            'is_targeted': nfl_id == targeted_receiver,
            'is_offense': player_data['club'] == play_info['possessionTeam'],
        }
        
        if nfl_id == targeted_receiver:
            role['role'] = 'targeted_receiver'
        elif role['is_offense']:
            role['role'] = 'offensive_player'
        else:
            role['role'] = 'defensive_player'
        
        player_roles.append(role)
    
    return pd.DataFrame(player_roles)

# Analyze player roles across all plays
role_summary = []
for (game_id, play_id), group in tracking_df.groupby(['gameId', 'playId']):
    play_info = plays_df[
        (plays_df['gameId'] == game_id) & 
        (plays_df['playId'] == play_id)
    ].iloc[0]
    
    roles = categorize_players(group, play_info)
    role_summary.append({
        'gameId': game_id,
        'playId': play_id,
        'n_offensive': (roles['role'] == 'offensive_player').sum(),
        'n_defensive': (roles['role'] == 'defensive_player').sum(),
        'has_targeted': (roles['role'] == 'targeted_receiver').sum() > 0
    })

role_summary_df = pd.DataFrame(role_summary)
print("\\nPlayer Role Summary:")
print(role_summary_df.describe())`,

    'movement-patterns': `# Analyze movement patterns
def calculate_movement_stats(play_tracking, pass_frame):
    """Calculate velocity and acceleration changes at pass"""
    
    stats = []
    
    for nfl_id in play_tracking['nflId'].unique():
        player_data = play_tracking[
            play_tracking['nflId'] == nfl_id
        ].sort_values('frameId')
        
        # Get data at pass frame
        at_pass = player_data[player_data['frameId'] == pass_frame]
        
        if len(at_pass) > 0:
            at_pass = at_pass.iloc[0]
            
            # Calculate speed
            speed = np.sqrt(at_pass['s']**2) if 's' in at_pass else 0
            
            # Get position change after pass (if available)
            after_pass = player_data[player_data['frameId'] > pass_frame]
            
            if len(after_pass) >= 5:  # Look at 0.5 seconds after
                future_pos = after_pass.iloc[4]
                
                # Calculate displacement
                displacement = np.sqrt(
                    (future_pos['x'] - at_pass['x'])**2 + 
                    (future_pos['y'] - at_pass['y'])**2
                )
                
                # Calculate direction change
                dir_change = abs(future_pos['dir'] - at_pass['dir']) if 'dir' in at_pass else 0
                
                stats.append({
                    'nflId': nfl_id,
                    'speed_at_pass': speed,
                    'displacement_0.5s': displacement,
                    'direction_change': dir_change,
                    'x_at_pass': at_pass['x'],
                    'y_at_pass': at_pass['y']
                })
    
    return pd.DataFrame(stats)

# Apply to sample plays
movement_stats_list = []
sample_plays = tracking_df.groupby(['gameId', 'playId']).size().head(10).index

for game_id, play_id in sample_plays:
    play_data, pass_frame, play_info = analyze_play(
        game_id, play_id, tracking_df, plays_df
    )
    if pass_frame is not None:
        stats = calculate_movement_stats(play_data, pass_frame)
        stats['gameId'] = game_id
        stats['playId'] = play_id
        movement_stats_list.append(stats)

if movement_stats_list:
    movement_df = pd.concat(movement_stats_list, ignore_index=True)
    print("\\nMovement Statistics:")
    print(movement_df.describe())`,

    'visualization': `# Visualization functions
def plot_play_trajectory(play_tracking, pass_frame, play_info, targeted_receiver):
    """Plot player trajectories for a single play"""
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
    
    # Pre-pass trajectories
    pre_pass = play_tracking[play_tracking['frameId'] <= pass_frame]
    
    for nfl_id in pre_pass['nflId'].unique():
        player_traj = pre_pass[pre_pass['nflId'] == nfl_id]
        
        if nfl_id == targeted_receiver:
            ax1.plot(player_traj['x'], player_traj['y'], 
                    'r-', linewidth=3, label='Targeted Receiver', alpha=0.8)
            ax1.scatter(player_traj.iloc[-1]['x'], player_traj.iloc[-1]['y'],
                       s=200, c='red', marker='o', zorder=5)
        else:
            is_offense = player_traj.iloc[0]['club'] == play_info['possessionTeam']
            color = 'blue' if is_offense else 'orange'
            ax1.plot(player_traj['x'], player_traj['y'], 
                    color=color, alpha=0.5, linewidth=1)
    
    ax1.set_title('Pre-Pass Movement', fontsize=14, fontweight='bold')
    ax1.set_xlabel('X Position (yards)')
    ax1.set_ylabel('Y Position (yards)')
    ax1.grid(True, alpha=0.3)
    ax1.legend()
    
    # Post-pass trajectories
    post_pass = play_tracking[play_tracking['frameId'] >= pass_frame]
    
    for nfl_id in post_pass['nflId'].unique():
        player_traj = post_pass[post_pass['nflId'] == nfl_id]
        
        if nfl_id == targeted_receiver:
            ax2.plot(player_traj['x'], player_traj['y'], 
                    'r-', linewidth=3, label='Targeted Receiver', alpha=0.8)
            ax2.scatter(player_traj.iloc[0]['x'], player_traj.iloc[0]['y'],
                       s=200, c='red', marker='o', zorder=5)
        else:
            is_offense = player_traj.iloc[0]['club'] == play_info['possessionTeam']
            color = 'blue' if is_offense else 'orange'
            ax2.plot(player_traj['x'], player_traj['y'], 
                    color=color, alpha=0.5, linewidth=1)
    
    # Add ball landing location if available
    if 'ballLandingX' in play_info and pd.notna(play_info['ballLandingX']):
        ax2.scatter(play_info['ballLandingX'], play_info['ballLandingY'],
                   s=300, c='green', marker='*', 
                   label='Ball Landing', zorder=10)
    
    ax2.set_title('Post-Pass Movement (Ball in Air)', fontsize=14, fontweight='bold')
    ax2.set_xlabel('X Position (yards)')
    ax2.set_ylabel('Y Position (yards)')
    ax2.grid(True, alpha=0.3)
    ax2.legend()
    
    plt.tight_layout()
    plt.savefig(f'play_{play_info["gameId"]}_{play_info["playId"]}_trajectory.png', 
                dpi=150, bbox_inches='tight')
    plt.show()

# Plot a sample play
if play_data is not None:
    plot_play_trajectory(play_data, pass_frame, play_info, 
                        play_info.get('targetNflId', None))`,

    'distance-analysis': `# Analyze distance to ball landing location
def analyze_distance_to_ball(tracking_df, plays_df):
    """Analyze how players move relative to ball landing location"""
    
    results = []
    
    for (game_id, play_id), group in tracking_df.groupby(['gameId', 'playId']):
        play_info = plays_df[
            (plays_df['gameId'] == game_id) & 
            (plays_df['playId'] == play_id)
        ].iloc[0]
        
        # Check if ball landing location is available
        if 'ballLandingX' not in play_info or pd.isna(play_info['ballLandingX']):
            continue
        
        ball_x = play_info['ballLandingX']
        ball_y = play_info['ballLandingY']
        targeted = play_info.get('targetNflId', None)
        
        # Find pass frame
        pass_frame = group[group['event'] == 'pass_forward']['frameId'].values
        if len(pass_frame) == 0:
            continue
        pass_frame = pass_frame[0]
        
        # Calculate distances for each player
        for nfl_id in group['nflId'].unique():
            player_data = group[group['nflId'] == nfl_id].sort_values('frameId')
            
            at_pass = player_data[player_data['frameId'] == pass_frame]
            if len(at_pass) == 0:
                continue
            at_pass = at_pass.iloc[0]
            
            # Distance at pass
            dist_at_pass = np.sqrt(
                (at_pass['x'] - ball_x)**2 + 
                (at_pass['y'] - ball_y)**2
            )
            
            # Distance at end (if available)
            after_pass = player_data[player_data['frameId'] > pass_frame]
            if len(after_pass) > 0:
                final_pos = after_pass.iloc[-1]
                dist_at_end = np.sqrt(
                    (final_pos['x'] - ball_x)**2 + 
                    (final_pos['y'] - ball_y)**2
                )
                
                results.append({
                    'gameId': game_id,
                    'playId': play_id,
                    'nflId': nfl_id,
                    'is_targeted': nfl_id == targeted,
                    'dist_at_pass': dist_at_pass,
                    'dist_at_end': dist_at_end,
                    'dist_change': dist_at_end - dist_at_pass,
                    'moved_toward_ball': dist_at_end < dist_at_pass
                })
    
    distance_df = pd.DataFrame(results)
    
    # Summary by player role
    print("\\nDistance to Ball Landing - Summary by Role:")
    print(distance_df.groupby('is_targeted')[
        ['dist_at_pass', 'dist_at_end', 'dist_change']
    ].mean())
    
    # Visualize
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    distance_df.boxplot(column='dist_change', by='is_targeted', ax=axes[0])
    axes[0].set_title('Distance Change by Player Type')
    axes[0].set_xlabel('Is Targeted Receiver')
    axes[0].set_ylabel('Distance Change (yards)')
    
    axes[1].scatter(distance_df[~distance_df['is_targeted']]['dist_at_pass'],
                   distance_df[~distance_df['is_targeted']]['dist_at_end'],
                   alpha=0.3, label='Other Players')
    axes[1].scatter(distance_df[distance_df['is_targeted']]['dist_at_pass'],
                   distance_df[distance_df['is_targeted']]['dist_at_end'],
                   alpha=0.7, c='red', label='Targeted Receiver')
    axes[1].plot([0, 50], [0, 50], 'k--', alpha=0.5)
    axes[1].set_xlabel('Distance at Pass (yards)')
    axes[1].set_ylabel('Distance at End (yards)')
    axes[1].set_title('Distance Evolution')
    axes[1].legend()
    
    plt.tight_layout()
    plt.show()
    
    return distance_df

# Run analysis
distance_analysis = analyze_distance_to_ball(tracking_df, plays_df)`
  };

  const sections = [
    { id: 'data-loading', title: 'Data Loading & Overview', icon: FileText },
    { id: 'play-structure', title: 'Play Structure Analysis', icon: Activity },
    { id: 'player-roles', title: 'Player Role Identification', icon: Users },
    { id: 'movement-patterns', title: 'Movement Patterns', icon: TrendingUp },
    { id: 'visualization', title: 'Trajectory Visualization', icon: Map },
    { id: 'distance-analysis', title: 'Distance to Ball Analysis', icon: Target }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Big Data Bowl 2026 - EDA Starter Kit</h1>
        <p className="text-blue-100">Exploratory Data Analysis code snippets for player tracking data</p>
      </div>
      
      <div className="flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-white border-r border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Analysis Steps</h3>
          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm">{section.title}</span>
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Code Display */}
        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
              <span className="text-gray-300 text-sm font-mono">
                {sections.find(s => s.id === activeSection)?.title}.py
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(codeSnippets[activeSection]);
                }}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
              >
                Copy Code
              </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto text-sm leading-relaxed">
              <code>{codeSnippets[activeSection]}</code>
            </pre>
          </div>
          
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">💡 What this code does:</h4>
            <p className="text-sm text-blue-800">
              {activeSection === 'data-loading' && "Loads all necessary data files and displays basic structure, shape, and column information. This is your starting point."}
              {activeSection === 'play-structure' && "Analyzes individual plays to understand the structure: finding pass frame, counting frames before/after, and identifying key events."}
              {activeSection === 'player-roles' && "Categorizes players into roles (targeted receiver, offensive players, defensive players) for each play to understand different movement behaviors."}
              {activeSection === 'movement-patterns' && "Calculates velocity, acceleration, and displacement statistics at the moment the ball is thrown and in the subsequent frames."}
              {activeSection === 'visualization' && "Creates visual representations of player trajectories before and after the pass, helping you understand movement patterns visually."}
              {activeSection === 'distance-analysis' && "Analyzes how players move relative to the ball landing location, particularly comparing targeted receivers to other players."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EDAStarterCode;